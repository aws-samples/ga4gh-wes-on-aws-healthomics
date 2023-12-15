const { OmicsClient, GetRunCommand, ResourceNotFoundException } = require("@aws-sdk/client-omics");

exports.main = async function(event, context) {

  try {
    const client = new OmicsClient({ region: "us-east-1" });

    const input = {
        id: event['id']
    };

    const command = new GetRunCommand(input);
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
