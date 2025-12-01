"use server";
import { Unkey } from "@unkey/api";
const rootKey = process.env.PLAYGROUND_ROOT_KEY;

//Create Key
export async function CreateKeyCommand(apiId: string) {
  if (!rootKey) {
    return { error: "Root Key Not Found" };
  }
  const unkey = new Unkey({ rootKey: rootKey });
  const { data, meta } = await unkey.keys.createKey({
    apiId: apiId,
    byteLength: 16,
    enabled: true,
  });
  const response = { data, meta };

  return response;
}

//Verify Key
export async function VerifyKeyCommand(key: string) {
  if (!rootKey) {
    return { error: "Root Key Not Found" };
  }
  const unkey = new Unkey({ rootKey: rootKey });
  const { data, meta } = await unkey.keys.verifyKey({
    key: key,
  });
  const response = { data, meta };

  return response;
}
// Get Key
export async function GetKeyCommand(keyId: string) {
  if (!rootKey) {
    return { error: "Root Key Not Found" };
  }
  const unkey = new Unkey({ rootKey: rootKey });
  const { data, meta } = await unkey.keys.getKey({
    keyId: keyId,
  });
  const response = { data, meta };

  return response;
}

// Update Key
export async function UpdateKeyCommand(
  keyId: string,
  externalId: string | undefined,
  metaData: Record<string, string> | undefined,
  expires: number | undefined,
  enabled: boolean | undefined,
) {
  if (!rootKey) {
    return { error: "Root Key Not Found" };
  }
  const unkey = new Unkey({ rootKey: rootKey });
  const { data, meta } = await unkey.keys.updateKey({
    keyId: keyId,
    externalId: externalId ?? undefined,
    meta: metaData ?? undefined,
    expires: expires ?? undefined,
    enabled: enabled ?? undefined,
  });

  const response = { data, meta };

  return response;
}

export async function DeleteKeyCommand(keyId: string) {
  if (!rootKey) {
    return { error: "Root Key Not Found" };
  }
  const unkey = new Unkey({ rootKey: rootKey });
  const { data, meta } = await unkey.keys.deleteKey({
    keyId: keyId,
  });
  const response = { data, meta };

  return response;
}
