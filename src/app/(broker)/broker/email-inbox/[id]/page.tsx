"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface Transaction {
  id: string;
  from_email: string;
  to_email: string;
  subject: string;
  received_at: string;
  status: string;
  extracted_client_number: string | null;
  extracted_policy_number: string | null;
  extracted_document_type: string | null;
  ai_confidence: Record<string, number> | null;
  ai_overall_confidence: number | null;
  suggested_client_id: string | null;
  suggested_policy_id: string | null;
  match_confidence: number | null;
  clients: {
    id: string;
    full_name: string;
    client_number: string;
    email: string;
  } | null;
  policies: {
    id: string;
    policy_number: string;
    insurer: string;
    policy_type: string;
  } | null;
  email_attachments: {
    id: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
    storage_url: string;
  }[];
}

interface Client {
  id: string;
  full_name: string;
  client_number: string;
}

interface Policy {
  id: string;
  policy_number: string;
  insurer: string;
  policy_type: string;
}

const DOCUMENT_TYPES = [
  { value: "policy_schedule", label: "Policy Schedule" },
  { value: "policy_wording", label: "Policy Wording" },
  { value: "invoice", label: "Invoice" },
  { value: "certificate", label: "Certificate" },
  { value: "renewal_notice", label: "Renewal Notice" },
  { value: "endorsement", label: "Endorsement" },
  { value: "claim_document", label: "Claim Document" },
  { value: "other", label: "Other" },
];

export default function EmailReviewPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>("");
  const [selectedDocType, setSelectedDocType] = useState<string>("");
  const [correctionReason, setCorrectionReason] = useState<string>("");

  useEffect(() => {
    fetchTransaction();
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (selectedClientId) {
      fetchPoliciesForClient(selectedClientId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  const fetchTransaction = async () => {
    try {
      const response = await fetch(`/api/broker/email-inbox/${id}`);
      const data = await response.json();
      if (data.transaction) {
        setTransaction(data.transaction);
        // Pre-fill form with AI suggestions
        if (data.transaction.suggested_client_id) {
          setSelectedClientId(data.transaction.suggested_client_id);
        }
        if (data.transaction.suggested_policy_id) {
          setSelectedPolicyId(data.transaction.suggested_policy_id);
        }
        if (data.transaction.extracted_document_type) {
          setSelectedDocType(data.transaction.extracted_document_type);
        }
      }
    } catch (error) {
      console.error("Error fetching transaction:", error);
      setError("Failed to load transaction");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await fetch("/api/broker/clients");
      const data = await response.json();
      setClients(data.clients || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  const fetchPoliciesForClient = async (clientId: string) => {
    try {
      const response = await fetch(`/api/broker/clients/${clientId}/policies`);
      const data = await response.json();
      setPolicies(data.policies || []);
    } catch (error) {
      console.error("Error fetching policies:", error);
    }
  };

  const handleApprove = async () => {
    if (!selectedClientId || !selectedPolicyId) {
      setError("Please select a client and policy");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/broker/email-inbox/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approved: true,
          clientId: selectedClientId,
          policyId: selectedPolicyId,
          documentType: selectedDocType,
          correctionReason: correctionReason || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to approve");
        return;
      }

      router.push("/broker/email-inbox");
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/broker/email-inbox/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approved: false,
          correctionReason: correctionReason || "Rejected by broker",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to reject");
        return;
      }

      router.push("/broker/email-inbox");
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "text-green-600";
    if (confidence >= 0.7) return "text-yellow-600";
    return "text-red-600";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">Transaction not found</p>
            <Link href="/broker/email-inbox">
              <Button className="mt-4">Back to Inbox</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/broker/email-inbox">
                <Button variant="outline" size="sm">
                  ← Back
                </Button>
              </Link>
              <h1 className="text-lg font-semibold text-gray-900 truncate">
                Review Document
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: PDF Preview */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Email Details</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><span className="text-gray-500">From:</span> {transaction.from_email}</p>
                <p><span className="text-gray-500">Subject:</span> {transaction.subject || "(No subject)"}</p>
                <p><span className="text-gray-500">Received:</span> {new Date(transaction.received_at).toLocaleString()}</p>
              </CardContent>
            </Card>

            {/* Attachments / PDF Preview */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Attachments</CardTitle>
              </CardHeader>
              <CardContent>
                {transaction.email_attachments?.length > 0 ? (
                  <div className="space-y-2">
                    {transaction.email_attachments.map((att) => (
                      <div key={att.id} className="border rounded-lg overflow-hidden">
                        <div className="p-3 bg-gray-50 flex items-center justify-between">
                          <span className="text-sm font-medium truncate">{att.filename}</span>
                          <span className="text-xs text-gray-500">
                            {Math.round(att.size_bytes / 1024)} KB
                          </span>
                        </div>
                        {att.mime_type === "application/pdf" && att.storage_url && (
                          <div className="aspect-[3/4] bg-gray-100">
                            <iframe
                              src={att.storage_url}
                              className="w-full h-full"
                              title={att.filename}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No attachments</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: AI Extraction & Form */}
          <div className="space-y-4">
            {/* AI Extraction Results */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>AI Extraction</span>
                  {transaction.ai_overall_confidence !== null && (
                    <span className={`text-sm font-normal ${getConfidenceColor(transaction.ai_overall_confidence)}`}>
                      {Math.round(transaction.ai_overall_confidence * 100)}% overall
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Client Number</p>
                    <p className="font-medium">
                      {transaction.extracted_client_number || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Policy Number</p>
                    <p className="font-medium">
                      {transaction.extracted_policy_number || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Document Type</p>
                    <p className="font-medium">
                      {transaction.extracted_document_type?.replace("_", " ") || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Match Confidence</p>
                    <p className={`font-medium ${transaction.match_confidence ? getConfidenceColor(transaction.match_confidence) : ""}`}>
                      {transaction.match_confidence
                        ? `${Math.round(transaction.match_confidence * 100)}%`
                        : "—"}
                    </p>
                  </div>
                </div>

                {transaction.clients && (
                  <div className="border-t pt-3">
                    <p className="text-gray-500 text-sm">Suggested Match</p>
                    <p className="font-medium">
                      {transaction.clients.full_name} ({transaction.clients.client_number})
                    </p>
                    {transaction.policies && (
                      <p className="text-sm text-gray-600">
                        {transaction.policies.insurer} - {transaction.policies.policy_number}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Review Form */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Review & Approve</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="client">Client *</Label>
                  <select
                    id="client"
                    value={selectedClientId}
                    onChange={(e) => {
                      setSelectedClientId(e.target.value);
                      setSelectedPolicyId("");
                    }}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select a client...</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.full_name} ({client.client_number})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="policy">Policy *</Label>
                  <select
                    id="policy"
                    value={selectedPolicyId}
                    onChange={(e) => setSelectedPolicyId(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={!selectedClientId}
                  >
                    <option value="">
                      {selectedClientId ? "Select a policy..." : "Select a client first"}
                    </option>
                    {policies.map((policy) => (
                      <option key={policy.id} value={policy.id}>
                        {policy.insurer} - {policy.policy_number} ({policy.policy_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="docType">Document Type</Label>
                  <select
                    id="docType"
                    value={selectedDocType}
                    onChange={(e) => setSelectedDocType(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select type...</option>
                    {DOCUMENT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Correction Note (optional)</Label>
                  <Input
                    id="reason"
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    placeholder="Why was AI suggestion changed?"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleApprove}
                    disabled={isSubmitting || !selectedClientId || !selectedPolicyId}
                    className="flex-1"
                  >
                    {isSubmitting ? "Processing..." : "Approve & Publish"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReject}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
