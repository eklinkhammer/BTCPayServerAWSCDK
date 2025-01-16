import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

export enum BtcPayServerNetwork {
	MAINNET = "mainnet"
}

export interface BtcPayServerConstructProps {
  vpc: ec2.IVpc;
  instanceType?: ec2.InstanceType;
  keyName?: string;
  btcpayHostName: string;
  network: BtcPayServerNetwork;
}

export class BtcPayServerAwscdk extends Construct {

  constructor(scope: Construct, id: string, props: BtcPayServerConstructProps) {
    super(scope, id);

	const ami = ec2.MachineImage.latestAmazonLinux2023();

	const role = new iam.Role(this, 'BTCPayServerInstanceRole', {
		assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
		managedPolicies: [
			iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
			iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2FullAccess'),
		],
	});

	const userDataScript = `#!/bin/bash
sudo su -
mkdir BTCPayServer
cd BTCPayServer
git clone https://github.com/btcpayserver/btcpayserver-docker
cd btcpayserver-docker
export BTCPAY_HOST="btcpay.{props.btcpayHostName}"
export NBITCOIN_NETWORK="{props.network}"
export BTCPAYGEN_CRYPTO1="btc"
export BTCPAYGEN_ADDITIONAL_FRAGMENTS="opt-save-storage-s"
export BTCPAYGEN_REVERSEPROXY="nginx"
export BTCPAYGEN_LIGHTNING="clightning"
export BTCPAY_ENABLE_SSH=true
. ./btcpay-setup.sh -i
exit
`;

    const securityGroup = new ec2.SecurityGroup(this, 'InstanceSecurityGroup', {
      vpc: props.vpc,
      description: 'Allow SSH and HTTP(S) traffic',
      allowAllOutbound: true,
    });

    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH access');
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP access');
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS access');

    // Create the EC2 instance
    new ec2.Instance(this, 'BTCPayServerInstance', {
      instanceType: props.instanceType || ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MEDIUM),
      machineImage: ami,
      vpc: props.vpc,
      role: role,
      keyName: props.keyName, // Optional, only if you want to use a key pair for SSH access
      securityGroup: securityGroup,
      userData: ec2.UserData.custom(userDataScript),
    });
  }
}
