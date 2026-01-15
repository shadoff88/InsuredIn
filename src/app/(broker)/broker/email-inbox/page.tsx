"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EmailTransaction {
  id: string;
  from_email: string;
  subject: string;
  received_at: string;
  status: string;
  extracted_document_type: string | null;
  ai_overall_confidence: number | null;
  match_confidence: number | null;
  clients: { full_name: string; client_number: string } | null;
  policies: { policy_number: string; insurer: string } | null;
  email_attachments: { filename: string }[];
}

interface StatusCounts {
  all: number;
  pending: number;
  awaiting_review: number;
  approved: number;
  rejected: number;
  error: number;
}

export default function BrokerEmailInboxPage() {
  const [transactions, setTransactions] = useState<EmailTransaction[]>([]);
  const [counts, setCounts] = useState<StatusCounts>({
    all: 0,
    pending: 0,
    awaiting_review: 0,
    approved: 0,
    rejected: 0,
    error: 0,
  });
  const [activeFilter, setActiveFilter] = useState("awaiting_review");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/broker/email-inbox?status=${activeFilter === "all" ? "all" : activeFilter}`
      );
      const data = await response.json();
      setTransactions(data.transactions || []);
      setCounts(data.counts || counts);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Processing" },
      awaiting_review: { bg: "bg-blue-100", text: "text-blue-800", label: "Awaiting Review" },
      approved: { bg: "bg-green-100", text: "text-green-800", label: "Approved" },
      rejected: { bg: "bg-red-100", text: "text-red-800", label: "Rejected" },
      error: { bg: "bg-red-100", text: "text-red-800", label: "Error" },
    };
    const badge = badges[status] || { bg: "bg-gray-100", text: "text-gray-800", label: status };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getConfidenceBadge = (confidence: number | null) => {
    if (confidence === null) return null;
    const pct = Math.round(confidence * 100);
    let color = "bg-red-100 text-red-800";
    if (pct >= 90) color = "bg-green-100 text-green-800";
    else if (pct >= 70) color = "bg-yellow-100 text-yellow-800";
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
        {pct}% match
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filters = [
    { key: "awaiting_review", label: "Awaiting Review", count: counts.awaiting_review },
    { key: "pending", label: "Processing", count: counts.pending },
    { key: "approved", label: "Approved", count: counts.approved },
    { key: "rejected", label: "Rejected", count: counts.rejected },
    { key: "all", label: "All", count: counts.all },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Email Inbox</h1>
              <p className="text-sm text-gray-500">Review AI-extracted documents</p>
            </div>
            <Link href="/broker/dashboard">
              <Button variant="outline" size="sm">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Filter Tabs - Mobile scrollable */}
      <div className="bg-white border-b overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-4 py-3" aria-label="Filter tabs">
            {filters.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                className={`whitespace-nowrap px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeFilter === filter.key
                    ? "bg-primary text-white"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                {filter.label}
                {filter.count > 0 && (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    activeFilter === filter.key ? "bg-white/20" : "bg-gray-200"
                  }`}>
                    {filter.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : transactions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-gray-400 text-5xl mb-4">📭</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No emails to review</h3>
              <p className="text-gray-500">
                {activeFilter === "awaiting_review"
                  ? "All caught up! No documents waiting for your review."
                  : `No emails with status "${activeFilter}"`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {transactions.map((tx) => (
              <Link key={tx.id} href={`/broker/email-inbox/${tx.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Subject & Status */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-medium text-gray-900 truncate">
                            {tx.subject || "(No subject)"}
                          </h3>
                          {getStatusBadge(tx.status)}
                        </div>

                        {/* From & Time */}
                        <p className="text-sm text-gray-500 mb-2">
                          From: {tx.from_email} · {formatDate(tx.received_at)}
                        </p>

                        {/* AI Extraction Info */}
                        <div className="flex flex-wrap gap-2 items-center">
                          {tx.extracted_document_type && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">
                              {tx.extracted_document_type.replace("_", " ")}
                            </span>
                          )}
                          {tx.clients && (
                            <span className="text-sm text-gray-600">
                              → {tx.clients.full_name}
                            </span>
                          )}
                          {tx.policies && (
                            <span className="text-sm text-gray-500">
                              ({tx.policies.policy_number})
                            </span>
                          )}
                          {getConfidenceBadge(tx.match_confidence)}
                        </div>

                        {/* Attachments */}
                        {tx.email_attachments?.length > 0 && (
                          <p className="text-xs text-gray-400 mt-2">
                            📎 {tx.email_attachments.length} attachment(s):{" "}
                            {tx.email_attachments.map((a) => a.filename).join(", ")}
                          </p>
                        )}
                      </div>

                      {/* Review Button - Mobile prominent */}
                      {tx.status === "awaiting_review" && (
                        <Button size="sm" className="shrink-0">
                          Review
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
