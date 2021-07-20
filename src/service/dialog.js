const dialogflow = require('@google-cloud/dialogflow');
const uuid = require('uuid');
const {MessageType} = require("@adiwajshing/baileys");
const {placeSendMessageOrder} = require("./worker");
const projectId = 'newagent-dtewlr'
/**
 * Send a query to the dialogflow agent, and return the query result.
 * @param {string} projectId The project to be used
 */
process.env.GOOGLE_APPLICATION_CREDENTIALS = './google.json';

const runDialog = async (text = '', chatId = '', indexInstance = 0) => {
    // A unique identifier for the given session
    const sessionId = uuid.v4();

    // Create a new session
    const sessionClient = new dialogflow.SessionsClient();
    const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);

    // The text query request.
    const request = {
        session: sessionPath,
        queryInput: {
            text: {
                // The query to send to the dialogflow agent
                text: text,
                // The language used by the client (en-US)
                languageCode: 'id-ID',
            },
        },
    };

    // Send request and log result
    const responses = await sessionClient.detectIntent(request);
    console.log('Detected intent');
    const result = responses[0].queryResult;
    console.log(`  Query: ${result.queryText}`);
    console.log(`  Response: ${result.fulfillmentText}`);
    if (result.intent) {
        console.log(`  Intent: ${result.intent.displayName}`);

        let order = {
            "instance": indexInstance,
            "chatId": chatId,
            'body': result.fulfillmentText,
            "type": MessageType.text
        }

        console.log("oder runDialog")
        console.log(order)
        if (result.fulfillmentText !== "")
            placeSendMessageOrder(order)
                .then((job) =>
                    console.log(`Your order will be ready in a while, queue id ${job.id}`))
                .catch(() => console.log(`Your order can't be place`)
                );
    } else {
        console.log(`  No intent matched.`);
    }
}
module.exports = {
    runDialog
};
