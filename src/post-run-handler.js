const { OmicsClient, StartRunCommand } = require("@aws-sdk/client-omics");

exports.main = async function(event, context) {
  
  try {    
    let body = JSON.parse(event.body);  // TODO: Accept and parse multipart form data instead of JSON to match the WES spec

    const client = new OmicsClient({ region: "us-east-1" });

    // Extract Workflow ID from custom Omics URL
    try {
        var workflow_id = body.workflow_url.match(/\d+$/)[0];
    }
    catch(error) {
        const errorResponse = {
            body: "[ValidationException] ".concat("Malformed workflow_url. Should be omics://workflow/[workflow_id]")
        };
        throw new Error(JSON.stringify(errorResponse));
    }

    var params = {
        requestId: Math.random().toString(36).substring(2,11),
        roleArn: process.env.role_arn,
        outputUri: process.env.output_uri + "/workflow-output/",
        parameters: body.workflow_params, // Dependent on the workflow
        tags: body.tags,
        workflowId: workflow_id
    };
    
    const command = new StartRunCommand(params);
    const data = await client.send(command);

    return {
      statusCode: 200,
      headers: {},
      body: data
    };

  } catch(error) {
    const errorResponse = {
        body: "[".concat(error.name).concat("] ").concat(error.message)
    };
    throw new Error(JSON.stringify(errorResponse));
  }
}