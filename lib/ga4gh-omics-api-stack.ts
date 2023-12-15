import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";
import * as fs from 'fs';
import { MockIntegration, PassthroughBehavior } from 'aws-cdk-lib/aws-apigateway';
import { OmicsServiceRole } from './constructs/omics-service-role';
import * as dataLocations from './config/data-locations.json';

export class Ga4GhOmicsApiStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create service role for running Omics jobs
    const omics_service_role = new OmicsServiceRole(this, 'OmicsServiceRole', {
        outputBucket: dataLocations.output_bucket_uri,
        inputBuckets: dataLocations.source_uris
    }).serviceRole;

    // Create API Gateway
    const api_dev = new apigw.RestApi(this, 'ga4gh-omics-api', {
        restApiName: `ga4gh-omics-api`,
        description: `GA4GH facade api for Amazon Omics`,
        cloudWatchRole: true
    })

    // Create a user group to govern access to the API through IAM users
    const omicsapiusergroup = new iam.Group(this, 'omicsapiusers');

    // Attach a policy statement to grant access to individual endpoints
    omicsapiusergroup.attachInlinePolicy(new iam.Policy(this, 'omicsapiuserspolicy', {
        statements: [new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['execute-api:Invoke'],
            resources: [
                `arn:aws:execute-api:${api_dev.env.region}:*:${api_dev.restApiId}/*/*/runs`,
                `arn:aws:execute-api:${api_dev.env.region}:*:${api_dev.restApiId}/*/*/runs/*/status`,
                `arn:aws:execute-api:${api_dev.env.region}:*:${api_dev.restApiId}/*/*/runs/*/tasks`,
                `arn:aws:execute-api:${api_dev.env.region}:*:${api_dev.restApiId}/*/*/runs/*/tasks/*`
            ],
        })],
    }));

    const error_vtl = fs.readFileSync('./lib/velocity_templates/error_vtl.txt','utf8');

    const error_status_codes = [
        {statusCode: '403'},
        {statusCode: '409'},
        {statusCode: '500'},
        {statusCode: '408'},
        {statusCode: '404'},
        {statusCode: '402'},
        {statusCode: '429'},
        {statusCode: '400'}
    ]

    const error_integration_responses = [
        {statusCode: '403', responseTemplates: {"application/json": error_vtl},selectionPattern: '.*AccessDeniedException.*'},
        {statusCode: '409', responseTemplates: {"application/json": error_vtl},selectionPattern: '.*ConflictException.*'},
        {statusCode: '500', responseTemplates: {"application/json": error_vtl},selectionPattern: '.*InternalServerException.*'},
        {statusCode: '408', responseTemplates: {"application/json": error_vtl},selectionPattern: '.*RequestTimeoutException.*'},
        {statusCode: '404', responseTemplates: {"application/json": error_vtl},selectionPattern: '.*ResourceNotFoundException.*'},
        {statusCode: '402', responseTemplates: {"application/json": error_vtl},selectionPattern: '.*ServiceQuotaExceededException.*'},
        {statusCode: '429', responseTemplates: {"application/json": error_vtl},selectionPattern: '.*ThrottlingException.*'},
        {statusCode: '400', responseTemplates: {"application/json": error_vtl},selectionPattern: '.*ValidationException.*'}
    ]

    //LIST RUNS

    // Create handler for listing runs and attach an inline policy to allow access to Omics
    const listRunsHandler = new lambda.Function(this, "list-runs-handler", {
        runtime: new lambda.Runtime('nodejs18.x'),
        code: lambda.Code.fromAsset(path.join(__dirname, "../src/")),
        handler: "list-runs-handler.main"
    });

    listRunsHandler.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonOmicsFullAccess'));

    // Create runs resource and attach the lambda handler for listing runs
    const runs_resource = api_dev.root.addResource('runs');

    const list_runs_method_options = {
        authorizationType: apigw.AuthorizationType.IAM,
        requestParameters: {
            'method.request.querystring.page_token': false,
            'method.request.querystring.page_size': false
        },
        methodResponses: [
            {statusCode: '200'}
        ].concat(error_status_codes)
    }

    const list_runs_request_vtl = fs.readFileSync('./lib/velocity_templates/list_runs_request_vtl.txt','utf8');
    const list_runs_response_vtl = fs.readFileSync('./lib/velocity_templates/list_runs_response_vtl.txt','utf8');

    const list_runs_lambda_integration_options = {
        proxy: false,
        requestTemplates: { "application/json": list_runs_request_vtl },
        integrationResponses: [
            {
                statusCode: '200',
                responseTemplates: {
                    "application/json": list_runs_response_vtl
                }
            }
        ].concat(error_integration_responses)
    }

    runs_resource.addMethod('GET', new apigw.LambdaIntegration(listRunsHandler, list_runs_lambda_integration_options), list_runs_method_options);

    //POST RUN

    const postRunHandler = new lambda.Function(this, "post-run-handler", {
        runtime: new lambda.Runtime('nodejs18.x'),
        code: lambda.Code.fromAsset(path.join(__dirname, "../src/")),
        handler: "post-run-handler.main",
        environment: {
            output_uri: dataLocations.output_bucket_uri,
            role_arn: omics_service_role.roleArn,
        }
    });
    postRunHandler.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonOmicsFullAccess'));

    const post_run_request_vtl = fs.readFileSync('./lib/velocity_templates/post_run_request_vtl.txt','utf8');
    const post_run_response_vtl = fs.readFileSync('./lib/velocity_templates/post_run_response_vtl.txt','utf8');

    const post_run_lambda_integration_options = {
        proxy: false,
        requestTemplates: { "application/json": post_run_request_vtl },
        integrationResponses: [
            {
                statusCode: '200',
                responseTemplates: {
                    "application/json": post_run_response_vtl
                }
            }
        ].concat(error_integration_responses)
    }

    const post_run_method_options = {
        authorizationType: apigw.AuthorizationType.IAM,
        methodResponses: [
            {statusCode: '200'}
        ].concat(error_status_codes)
    }

    runs_resource.addMethod('POST', new apigw.LambdaIntegration(postRunHandler, post_run_lambda_integration_options), post_run_method_options);

    //SERVICE INFO

    const service_info_resource = api_dev.root.addResource('service-info');
    const service_info_method_options = {
        methodResponses: [
            {statusCode: '200'},
            {statusCode: '403'},
            {statusCode: '500'}
        ]
    }
    const service_info_response = fs.readFileSync('./lib/static_data/service_info.json','utf8');
    const service_info_mock_integration = new MockIntegration({
            passthroughBehavior: PassthroughBehavior.WHEN_NO_TEMPLATES,
             requestTemplates: {
                'application/json': '{ "statusCode": 200 }'
            },
            integrationResponses: [{
                statusCode: '200',
                responseTemplates: {
                    'application/json': service_info_response
                }
            },
            {
                statusCode: '500',
                selectionPattern: '500',
                responseTemplates: {
                    'application/json': `{"error": "An unexpected error occurred"}`
                }
            }
            ]
        });
    service_info_resource.addMethod('GET', service_info_mock_integration, service_info_method_options);


    //GET RUN
    const run_request_vtl = fs.readFileSync('./lib/velocity_templates/run_request_vtl.txt','utf8');

    const runs_run_id_resource = runs_resource.addResource("{run_id}")

    const get_run_method_options = {
        authorizationType: apigw.AuthorizationType.IAM,
        requestParameters: {
             'method.request.path.run_id': true
        },
        methodResponses: [
            {statusCode: '200'}
        ].concat(error_status_codes)
    }

    const getRunHandler = new lambda.Function(this, "get-run-hander", {
        runtime: new lambda.Runtime('nodejs18.x'),
        code: lambda.Code.fromAsset(path.join(__dirname, "../src/")),
        handler: "get-run-handler.main"
    });
    getRunHandler.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonOmicsFullAccess'));
    const run_response_vtl = fs.readFileSync('./lib/velocity_templates/run_response_vtl.txt','utf8');

    const get_run_lambda_integration_options = {
        proxy: false,
        requestParameters: {
            "integration.request.path.id": "method.request.path.run_id"
        },
        requestTemplates: { "application/json": run_request_vtl },
        integrationResponses: [
            {
                statusCode: '200',
                responseTemplates: {
                    "application/json": run_response_vtl
                }
            }
        ].concat(error_integration_responses)
    }

    runs_run_id_resource.addMethod('GET', new apigw.LambdaIntegration(getRunHandler, get_run_lambda_integration_options), get_run_method_options);

    //RUN TASKS
    const run_tasks_resources = runs_run_id_resource.addResource("tasks");

    const run_tasks_method_options = {
        authorizationType: apigw.AuthorizationType.IAM,
        requestParameters: {
            'method.request.path.run_id': true,
            'method.request.querystring.page_token': false,
            'method.request.querystring.page_size': false
        },
        methodResponses: [
            {statusCode: '200'}
        ].concat(error_status_codes)
    }

    const runTasksHandler = new lambda.Function(this, "run-tasks-handler", {
        runtime: new lambda.Runtime('nodejs18.x'),
        code: lambda.Code.fromAsset(path.join(__dirname, "../src/")),
        handler: "run-tasks-handler.main"
    });
    runTasksHandler.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonOmicsFullAccess'));

    const run_tasks_response_vtl = fs.readFileSync('./lib/velocity_templates/run_tasks_response_vtl.txt','utf8');
    const run_tasks_request_vtl = fs.readFileSync('./lib/velocity_templates/run_tasks_request_vtl.txt','utf8');

    const run_tasks_lambda_integration_options = {
        proxy: false,
        requestTemplates: { "application/json": run_tasks_request_vtl },
        integrationResponses: [
            {
                statusCode: '200',
                responseTemplates: {
                    "application/json": run_tasks_response_vtl
                }
            }
        ].concat(error_integration_responses)
    }

     run_tasks_resources.addMethod('GET', new apigw.LambdaIntegration(runTasksHandler, run_tasks_lambda_integration_options), run_tasks_method_options);

    //TASK
    const task_id_resource = run_tasks_resources.addResource("{task_id}");
    const task_id_method_options = {
        authorizationType: apigw.AuthorizationType.IAM,
        requestParameters: {
            'method.request.path.run_id': true,
            'method.request.path.task_id': true
        },
        methodResponses: [
            {statusCode: '200'}
        ].concat(error_status_codes)
    }
    const GetTaskHandler = new lambda.Function(this, "get-task-handler", {
        runtime: new lambda.Runtime('nodejs18.x'),
        code: lambda.Code.fromAsset(path.join(__dirname, "../src/")),
        handler: "get-task-handler.main"
    });
    GetTaskHandler.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonOmicsFullAccess'));

    const task_request_vtl = fs.readFileSync('./lib/velocity_templates/task_request_vtl.txt','utf8');
    const task_response_vtl = fs.readFileSync('./lib/velocity_templates/task_response_vtl.txt','utf8');

    const get_task_lambda_integration_options = {
        proxy: false,
        requestTemplates: { "application/json": task_request_vtl },
        integrationResponses: [
            {
                statusCode: '200',
                responseTemplates: {
                    "application/json": task_response_vtl
                }
            }
        ].concat(error_integration_responses)
    }
    task_id_resource.addMethod('GET', new apigw.LambdaIntegration(GetTaskHandler, get_task_lambda_integration_options), task_id_method_options);


    //CANCEL RUN
    const runs_run_id_cancel_resource = runs_run_id_resource.addResource("cancel")

    const post_cancel_run_method_options = {
        authorizationType: apigw.AuthorizationType.IAM,
        requestParameters: {
            'method.request.path.run_id': true
        },
        methodResponses: [
            {statusCode: '200'}
        ].concat(error_status_codes)
    }

    const cancelRunHandler = new lambda.Function(this, "cancel-run-hander", {
        runtime: new lambda.Runtime('nodejs18.x'),
        code: lambda.Code.fromAsset(path.join(__dirname, "../src/")),
        handler: "cancel-run-handler.main"
    });

    cancelRunHandler.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonOmicsFullAccess'));

    const cancel_run_response_vtl = fs.readFileSync('./lib/velocity_templates/cancel_run_response_vtl.txt','utf8');

    const cancel_run_lambda_integration_options = {
        proxy: false,
        requestTemplates: { "application/json": run_request_vtl },
        integrationResponses: [
            {
                statusCode: '200',
                responseTemplates: {
                    "application/json": cancel_run_response_vtl
                }
            }
        ].concat(error_integration_responses)
    }

    runs_run_id_cancel_resource.addMethod('POST', new apigw.LambdaIntegration(cancelRunHandler, cancel_run_lambda_integration_options), post_cancel_run_method_options);

    //RUN STATUS
    const runs_run_id_status_resource = runs_run_id_resource.addResource("status");
    const run_response_status_vtl = fs.readFileSync('./lib/velocity_templates/run_response_status_vtl.txt','utf8');

    const get_run_status_lambda_integration_options = {
        proxy: false,
        requestTemplates: { "application/json": run_request_vtl },
        integrationResponses: [
            {
                statusCode: '200',
                responseTemplates: {
                    "application/json": run_response_status_vtl
                }
            }
        ].concat(error_integration_responses)
    }

    runs_run_id_status_resource.addMethod('GET', new apigw.LambdaIntegration(getRunHandler, get_run_status_lambda_integration_options), get_run_method_options);

  }
}