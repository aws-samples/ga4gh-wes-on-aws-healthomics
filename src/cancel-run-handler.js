const { OmicsClient, CancelRunCommand } = require("@aws-sdk/client-omics");

exports.main = async function(event, context) {
  try {
    const config = { region: "us-east-1" };
    const client = new OmicsClient(config);
    const input = {
      id: event['id']
    };
    const command = new CancelRunCommand(input);
    const response = await client.send(command);

    return {
      statusCode: 200,
      headers: {},
      body: {
        id: event['id']
      }
    };
  }

  catch(error) {
    const errorResponse = {
        body: "[".concat(error.name).concat("] ").concat(error.message)
    };
    throw new Error(JSON.stringify(errorResponse));
  }

}