#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { WorldLensStack } from '../lib/world-lens-stack';
import { BedrockProfilesStack } from '../lib/bedrock-profiles-stack';

const app = new cdk.App();

cdk.Tags.of(app).add('Project', 'WorldLens');

new WorldLensStack(app, 'WorldLensStack', {
  env: {
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  bedrockRegion: process.env.BEDROCK_REGION || 'us-east-1',
  description: 'WorldLens hackathon infrastructure — DynamoDB, WebSocket API, Lambda functions',
});

new BedrockProfilesStack(app, 'WorldLensBedrockProfiles', {
  env: {
    region: process.env.BEDROCK_REGION || 'us-east-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  description: 'WorldLens Bedrock inference profiles for Nova 2',
});
