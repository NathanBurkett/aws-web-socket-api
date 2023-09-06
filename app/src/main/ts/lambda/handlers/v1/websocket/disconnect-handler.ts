import { APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { DeleteCommandInput } from '@aws-sdk/lib-dynamodb';
import { dynamoDbDocument } from '../../../../dynamo/dynamo-db-document';

exports.handler = async (event: APIGatewayProxyWebsocketEventV2): Promise<APIGatewayProxyResultV2> => {
    try {
        console.log(event);

        const deleteParams: DeleteCommandInput = {
            TableName: process.env.CONNECTION_TABLE_NAME,
            Key: {
                connectionId: event.requestContext.connectionId
            }
        };

        await dynamoDbDocument.delete(deleteParams);
    } catch (err) {
        return { statusCode: 500, body: 'Failed to disconnect: ' + JSON.stringify(err) };
    }

    return { statusCode: 200, body: 'Disconnected.' };
};
