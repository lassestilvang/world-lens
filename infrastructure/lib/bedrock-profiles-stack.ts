import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { Construct } from 'constructs';

export class BedrockProfilesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const region = cdk.Stack.of(this).region;

    const sonicModelArn = `arn:aws:bedrock:${region}::foundation-model/amazon.nova-2-sonic-v1:0`;
    const liteModelArn = `arn:aws:bedrock:${region}::foundation-model/amazon.nova-2-lite-v1:0`;

    const sonicInferenceProfile = new bedrock.CfnApplicationInferenceProfile(
      this,
      'WorldLensSonicInferenceProfile',
      {
        inferenceProfileName: 'worldlens-nova-2-sonic',
        description: 'WorldLens inference profile for Nova 2 Sonic',
        modelSource: { copyFrom: sonicModelArn },
      }
    );

    const liteInferenceProfile = new bedrock.CfnApplicationInferenceProfile(
      this,
      'WorldLensLiteInferenceProfile',
      {
        inferenceProfileName: 'worldlens-nova-2-lite',
        description: 'WorldLens inference profile for Nova 2 Lite',
        modelSource: { copyFrom: liteModelArn },
      }
    );

    new cdk.CfnOutput(this, 'SonicInferenceProfileArn', {
      value: sonicInferenceProfile.attrInferenceProfileArn,
      description: 'Inference profile ARN for Nova 2 Sonic',
      exportName: 'WorldLensSonicInferenceProfileArn',
    });

    new cdk.CfnOutput(this, 'LiteInferenceProfileArn', {
      value: liteInferenceProfile.attrInferenceProfileArn,
      description: 'Inference profile ARN for Nova 2 Lite',
      exportName: 'WorldLensLiteInferenceProfileArn',
    });
  }
}
