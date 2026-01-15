import { createClient } from "@/lib/supabase/server";
import type { ExtractionResult } from "@/lib/ai/extract-document";

export interface MatchResult {
  clientId: string | null;
  clientName: string | null;
  clientNumber: string | null;
  policyId: string | null;
  policyNumber: string | null;
  confidence: number;
  matchType: "exact" | "partial" | "none";
  matchDetails: string;
}

export async function findBestMatch(
  brokerId: string,
  extraction: ExtractionResult
): Promise<MatchResult> {
  const supabase = await createClient();

  const { clientNumber, policyNumber } = extraction;

  // Priority 1: Both client_number AND policy_number match (98% confidence)
  if (clientNumber.value && policyNumber.value && clientNumber.confidence > 0.7 && policyNumber.confidence > 0.7) {
    const { data: exactMatch } = await supabase
      .from("policies")
      .select(`
        id,
        policy_number,
        packages!inner (
          clients!inner (
            id,
            full_name,
            client_number
          )
        )
      `)
      .eq("broker_id", brokerId)
      .ilike("policy_number", `%${policyNumber.value}%`)
      .limit(1)
      .single();

    if (exactMatch) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const packages = exactMatch.packages as any;
      const client = packages?.clients;
      if (client?.client_number?.toLowerCase().includes(clientNumber.value.toLowerCase())) {
        return {
          clientId: client.id,
          clientName: client.full_name,
          clientNumber: client.client_number,
          policyId: exactMatch.id,
          policyNumber: exactMatch.policy_number,
          confidence: 0.98,
          matchType: "exact",
          matchDetails: "Matched on both client number and policy number",
        };
      }
    }
  }

  // Priority 2: Policy number only (85% confidence)
  if (policyNumber.value && policyNumber.confidence > 0.7) {
    const { data: policyMatch } = await supabase
      .from("policies")
      .select(`
        id,
        policy_number,
        packages!inner (
          clients!inner (
            id,
            full_name,
            client_number
          )
        )
      `)
      .eq("broker_id", brokerId)
      .ilike("policy_number", `%${policyNumber.value}%`)
      .limit(1)
      .single();

    if (policyMatch) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const packages = policyMatch.packages as any;
      const client = packages?.clients;
      if (client) {
        return {
          clientId: client.id,
          clientName: client.full_name,
          clientNumber: client.client_number,
          policyId: policyMatch.id,
          policyNumber: policyMatch.policy_number,
          confidence: 0.85,
          matchType: "partial",
          matchDetails: "Matched on policy number only",
        };
      }
    }
  }

  // Priority 3: Client number only (80% confidence)
  if (clientNumber.value && clientNumber.confidence > 0.7) {
    const { data: clientMatch } = await supabase
      .from("clients")
      .select("id, full_name, client_number")
      .eq("broker_id", brokerId)
      .ilike("client_number", `%${clientNumber.value}%`)
      .limit(1)
      .single();

    if (clientMatch) {
      return {
        clientId: clientMatch.id,
        clientName: clientMatch.full_name,
        clientNumber: clientMatch.client_number,
        policyId: null,
        policyNumber: null,
        confidence: 0.80,
        matchType: "partial",
        matchDetails: "Matched on client number only - policy needs manual selection",
      };
    }
  }

  // No match found
  return {
    clientId: null,
    clientName: null,
    clientNumber: null,
    policyId: null,
    policyNumber: null,
    confidence: 0,
    matchType: "none",
    matchDetails: "No matching client or policy found - manual entry required",
  };
}

export async function getClientPolicies(brokerId: string, clientId: string) {
  const supabase = await createClient();

  const { data: policies } = await supabase
    .from("policies")
    .select(`
      id,
      policy_number,
      insurer,
      policy_type,
      status,
      packages!inner (
        client_id
      )
    `)
    .eq("broker_id", brokerId)
    .eq("packages.client_id", clientId)
    .eq("status", "active");

  return policies || [];
}

export async function getAllClients(brokerId: string) {
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, full_name, client_number, email")
    .eq("broker_id", brokerId)
    .order("full_name");

  return clients || [];
}
