import { createClient } from "@/lib/supabase/server";

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
  };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    user: {
      id: data.user.id,
      email: data.user.email!,
    },
  };
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (!data.user) {
    return { success: false, error: "Failed to create user" };
  }

  return {
    success: true,
    user: {
      id: data.user.id,
      email: data.user.email!,
    },
  };
}

export async function signOut(): Promise<AuthResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getBrokerUser() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  console.log('[getBrokerUser] Auth user check:', {
    userId: user?.id,
    userEmail: user?.email,
    userError: userError?.message,
  });

  if (!user) {
    console.log('[getBrokerUser] No auth user found, returning null');
    return null;
  }

  // Use admin client to bypass RLS since we've already verified auth
  // This works around the issue where auth cookies aren't being sent on server requests
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const adminClient = createAdminClient();

  const { data: brokerUser, error: brokerError } = await adminClient
    .from("broker_users")
    .select("*, brokers(*)")
    .eq("user_id", user.id)
    .single();

  console.log('[getBrokerUser] Broker user query result:', {
    found: !!brokerUser,
    brokerUserId: brokerUser?.id,
    brokerId: brokerUser?.broker_id,
    error: brokerError?.message,
    errorCode: brokerError?.code,
    errorDetails: brokerError?.details,
    errorHint: brokerError?.hint,
  });

  if (brokerError) {
    console.error('[getBrokerUser] Error fetching broker user:', {
      message: brokerError.message,
      code: brokerError.code,
      details: brokerError.details,
      hint: brokerError.hint,
    });
  }

  return brokerUser;
}

export async function getClientUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: clientUser } = await supabase
    .from("client_users")
    .select("*, clients(*, brokers(*))")
    .eq("user_id", user.id)
    .single();

  return clientUser;
}
