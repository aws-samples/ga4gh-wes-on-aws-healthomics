import { Construct } from 'constructs';
import { Stack } from 'aws-cdk-lib';
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from 'aws-cdk-lib/aws-s3';
import { URL } from 'url';
import { Arn } from 'aws-cdk-lib';

type CustomServiceRoleProps = {
    region?: string,
    account?: string,
    inputBuckets?: string[],
    outputBucket: string,
};

export class OmicsServiceRole extends Construct {

    public serviceRole: iam.Role;

    constructor(scope: Construct, id: string, props: CustomServiceRoleProps) {
        super(scope, id);

        const {
            region = Stack.of(scope).region,
            account = Stack.of(scope).account,
            inputBuckets,
            outputBucket,
        } = props;

        const omics_service_role = new iam.Role(this, 'OmicsServiceRole', {
            assumedBy: new iam.ServicePrincipal('omics.amazonaws.com'),
            description: 'Service role to run Omics jobs.',
        });

        omics_service_role.addToPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                resources: [`arn:aws:omics:${region}:${account}:sequenceStore/*`, 
                            `arn:aws:omics:${region}:${account}:referenceStore/*`],
                actions: [            
                    'omics:*'
                ]
            })
        );

        omics_service_role.addToPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    's3:GetObject',
                    's3:PutObject',
                    's3:ListBucket'
                ],
                resources: this._generate_bucket_resources([outputBucket])
            })
        );

        if (inputBuckets) {
            omics_service_role.addToPolicy(
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        "s3:GetObject",
                        "s3:ListBucket"
                    ],
                    resources: this._generate_bucket_resources(inputBuckets)
                })
            );    
        }

        omics_service_role.addToPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                resources: [`arn:aws:logs:${region}:${account}:log-group:/aws/omics/WorkflowLog:log-stream:*`],
                actions: [            
                    'logs:DescribeLogStreams',
                    'logs:CreateLogStream',
                    'logs:PutLogEvents'
                ]
            })
        );

        omics_service_role.addToPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                resources: [`arn:aws:logs:${region}:${account}:log-group:/aws/omics/WorkflowLog:*`],
                actions: [            
                    'logs:CreateLogGroup'
                ]
            })
        );

        this.serviceRole = omics_service_role;
    }

    private _generate_bucket_resources(s3uris: string[]): string[] {
        // for each uri
        // create a bucket resource for s3:ListBucket
        // create a prefix resource for s3:GetObject
    
        return s3uris.map( s3uri => {
            let url = new URL(s3uri)
            let bucketname = url.hostname;
            let prefix = url.pathname;
    
            let bucket_arn = Arn.format(
                {service: "s3", region: "", account: "", resource: bucketname}, Stack.of(this)
            )
    
            let prefix_arn;
            if (prefix && prefix.length) {
                prefix = prefix.slice(1);
                if (prefix.endsWith('/')) {
                    // prefix is provided as a folder
                    prefix = prefix + "*";
                } else {
                    // prefix is provided as a key, assume it's a folder
                    prefix = prefix + "/*"
                }
                prefix_arn = Arn.format(
                    {service: "s3", region: "", account: "", resource: bucketname, resourceName: prefix}, Stack.of(this)
                )
            } else {
                prefix_arn = Arn.format(
                    {service: "s3", region: "", account: "", resource: bucketname, resourceName: "*"}, Stack.of(this)
                )
            }
    
            return [bucket_arn, prefix_arn]
        }).flat()
    }
}