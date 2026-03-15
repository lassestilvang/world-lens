#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { WorldLensStack } from '../lib/world-lens-stack';

const app = new cdk.App();

new WorldLensStack(app, 'WorldLensStack', {
  env: {
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  description: 'WorldLens hackathon infrastructure — DynamoDB, WebSocket API, Lambda functions',
});
