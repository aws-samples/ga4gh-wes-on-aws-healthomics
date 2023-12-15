const { OmicsClient, GetRunTaskCommand, ResourceNotFoundException } = require("@aws-sdk/client-omics");

exports.main = async function(event, context) {

  try {
    const client = new OmicsClient({ region: "us-east-1" });

    const command = new GetRunTaskCommand(event);
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