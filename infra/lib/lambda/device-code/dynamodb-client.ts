import { 
  DynamoDBClient, 
  PutItemCommand, 
  GetItemCommand, 
  UpdateItemCommand,
  DeleteItemCommand,
  QueryCommand
} from '@aws-sdk/client-dynamodb';
import { DeviceCodeRecord, DeviceCodeStatus } from './types';

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.DEVICE_CODE_TABLE_NAME || 'thesafezone-device-codes';
const USER_CODE_INDEX = 'userCode-index';

/**
 * Stores a new device code record in DynamoDB
 */
export async function storeDeviceCode(record: DeviceCodeRecord): Promise<void> {
  const item: Record<string, any> = {
    deviceCode: { S: record.deviceCode },
    userCode: { S: record.userCode },
    clientId: { S: record.clientId },
    scope: { S: record.scope },
    expiresAt: { N: record.expiresAt.toString() },
    interval: { N: record.interval.toString() },
    status: { S: record.status },
    ttl: { N: record.ttl.toString() },
    createdAt: { N: record.createdAt.toString() },
  };

  if (record.userId) {
    item.userId = { S: record.userId };
  }

  if (record.tokens) {
    item.tokens = {
      M: {
        accessToken: { S: record.tokens.accessToken },
        idToken: { S: record.tokens.idToken },
        refreshToken: { S: record.tokens.refreshToken },
      },
    };
  }

  await client.send(new PutItemCommand({
    TableName: TABLE_NAME,
    Item: item,
    ConditionExpression: 'attribute_not_exists(deviceCode)',
  }));
}

/**
 * Retrieves a device code record by device code
 */
export async function getDeviceCodeByDeviceCode(deviceCode: string): Promise<DeviceCodeRecord | null> {
  const result = await client.send(new GetItemCommand({
    TableName: TABLE_NAME,
    Key: {
      deviceCode: { S: deviceCode },
    },
  }));

  if (!result.Item) return null;
  return mapItemToRecord(result.Item);
}


/**
 * Retrieves a device code record by user code (using GSI)
 */
export async function getDeviceCodeByUserCode(userCode: string): Promise<DeviceCodeRecord | null> {
  const result = await client.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: USER_CODE_INDEX,
    KeyConditionExpression: 'userCode = :userCode',
    ExpressionAttributeValues: {
      ':userCode': { S: userCode },
    },
    Limit: 1,
  }));

  if (!result.Items || result.Items.length === 0) return null;
  return mapItemToRecord(result.Items[0]);
}

/**
 * Updates the status and tokens of a device code record
 */
export async function updateDeviceCodeStatus(
  deviceCode: string,
  status: DeviceCodeStatus,
  userId?: string,
  tokens?: { accessToken: string; idToken: string; refreshToken: string }
): Promise<void> {
  const updateExpressions: string[] = ['#status = :status'];
  const expressionAttributeNames: Record<string, string> = { '#status': 'status' };
  const expressionAttributeValues: Record<string, any> = { ':status': { S: status } };

  if (userId) {
    updateExpressions.push('userId = :userId');
    expressionAttributeValues[':userId'] = { S: userId };
  }

  if (tokens) {
    updateExpressions.push('tokens = :tokens');
    expressionAttributeValues[':tokens'] = {
      M: {
        accessToken: { S: tokens.accessToken },
        idToken: { S: tokens.idToken },
        refreshToken: { S: tokens.refreshToken },
      },
    };
  }

  await client.send(new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: {
      deviceCode: { S: deviceCode },
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  }));
}

/**
 * Deletes a device code record
 */
export async function deleteDeviceCode(deviceCode: string): Promise<void> {
  await client.send(new DeleteItemCommand({
    TableName: TABLE_NAME,
    Key: {
      deviceCode: { S: deviceCode },
    },
  }));
}

/**
 * Maps a DynamoDB item to a DeviceCodeRecord
 */
function mapItemToRecord(item: Record<string, any>): DeviceCodeRecord {
  const record: DeviceCodeRecord = {
    deviceCode: item.deviceCode.S,
    userCode: item.userCode.S,
    clientId: item.clientId.S,
    scope: item.scope.S,
    expiresAt: parseInt(item.expiresAt.N, 10),
    interval: parseInt(item.interval.N, 10),
    status: item.status.S as DeviceCodeStatus,
    ttl: parseInt(item.ttl.N, 10),
    createdAt: parseInt(item.createdAt.N, 10),
  };

  if (item.userId) {
    record.userId = item.userId.S;
  }

  if (item.tokens) {
    record.tokens = {
      accessToken: item.tokens.M.accessToken.S,
      idToken: item.tokens.M.idToken.S,
      refreshToken: item.tokens.M.refreshToken.S,
    };
  }

  return record;
}
