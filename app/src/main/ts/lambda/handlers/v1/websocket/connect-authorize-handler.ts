import { APIGatewayRequestAuthorizerHandler } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { CognitoIdTokenPayload } from 'aws-jwt-verify/jwt-model';
import { APIGatewayAuthorizerResult } from 'aws-lambda/trigger/api-gateway-authorizer';

export const handler: APIGatewayRequestAuthorizerHandler = async (event): Promise<APIGatewayAuthorizerResult> => {
    try {
        const userPoolId = process.env.USER_POOL_ID;
        const appClientId = process.env.APP_CLIENT_ID;

        const verifier = CognitoJwtVerifier.create({
            userPoolId,
            tokenUse: 'id',
            clientId: appClientId,
        });

        const encodedToken = event.queryStringParameters.idToken;
        const payload = await verifier.verify(encodedToken);
        console.log('Token is valid. Payload:', payload);

        return allowPolicy(event.methodArn, payload);
    } catch (error: any) {
        console.error(error.message);
        return denyAllPolicy();
    }
};

const denyAllPolicy = () => {
    return {
        principalId: "*",
        policyDocument: {
            Version: "2012-10-17",
            Statement: [
                {
                    Action: "*",
                    Effect: "Deny",
                    Resource: "*",
                },
            ],
        },
    };
};

const allowPolicy = (methodArn: string, idToken: CognitoIdTokenPayload) => {
    const rawPoeAuthorizations = String(idToken[`custom:poeAuthorizations`]);
    const poeAuthorizations = JSON.parse(rawPoeAuthorizations);

    return {
        principalId: idToken.sub,
        policyDocument: {
            Version: "2012-10-17",
            Statement: [
                {
                    Action: "execute-api:Invoke",
                    Effect: "Allow",
                    Resource: methodArn,
                },
            ],
        },
        context: {
            authorization_practice_pims: poeAuthorizations[0].practice_pims,
            authorization_practice_organization_id: poeAuthorizations[0].practice_organization_id,
            authorization_practice_organization_sub_id: poeAuthorizations[0].practice_organization_sub_id,
        },
    };
};
