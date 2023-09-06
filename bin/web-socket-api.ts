#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { WebSocketApiStack } from '../lib/web-socket-api-stack';

const env = {
    account: process.env.CDK_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_REGION || process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new WebSocketApiStack(app, `poe-sandbox-web-socket-api`, {
    env,
    description: `POE Sandbox Web Socket API Stack (COM-4080)`
});
