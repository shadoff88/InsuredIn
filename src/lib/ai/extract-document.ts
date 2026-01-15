import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ExtractionResult {
  clientNumber: {
    value: string | null;
    confidence: number;
  };
  policyNumber: {
    value: string | null;
    confidence: number;
  };
  documentType: {
    value: string | null;
    confidence: number;
  };
  insurer: {
    value: string | null;
    confidence: number;
  };
  overallConfidence: number;
}

const EXTRACTION_PROMPT = `You are an AI assistant specialized in extracting information from insurance documents.

Analyze this document and extract the following information:

1. **Client Number** (HIGHEST PRIORITY):
   Look for: "Client No:", "Client Number:", "Client Ref:", "Account No:", "Customer ID:"
   Common formats: "CL-12345", "AKL-9876", "C00789", alphanumeric codes

2. **Policy Number**:
   Look for: "Policy Number:", "Pol No:", "Policy Ref:", "Certificate No:"
   Common formats: "DPK 5719028", "POL-ABC123", alphanumeric with possible spaces

3. **Document Type**:
   Determine the type based on content:
   - "policy_schedule" - Coverage summary, declarations page
   - "policy_wording" - Full terms and conditions
   - "invoice" - Payment due, premium notice
   - "certificate" - Certificate of insurance, proof of coverage
   - "renewal_notice" - Renewal offer, upcoming renewal
   - "endorsement" - Policy amendment, change notice
   - "claim_document" - Claim form, claim correspondence

4. **Insurer Name**:
   Look for the insurance company name in headers, logos, or footer

Return your response as valid JSON with confidence scores (0.0 to 1.0):
{
  "clientNumber": {"value": "extracted value or null", "confidence": 0.95},
  "policyNumber": {"value": "extracted value or null", "confidence": 0.98},
  "documentType": {"value": "one of the types above", "confidence": 0.99},
  "insurer": {"value": "insurer name or null", "confidence": 0.90}
}

IMPORTANT:
- If a field is not found, set value to null and confidence to 0
- Confidence should reflect how certain you are about the extraction
- Only return the JSON object, no other text`;

export async function extractDocumentInfo(
  documentContent: string,
  emailSubject?: string
): Promise<ExtractionResult> {
  const contextInfo = emailSubject
    ? `\n\nEmail Subject: "${emailSubject}"`
    : "";

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `${EXTRACTION_PROMPT}${contextInfo}\n\nDocument Content:\n${documentContent}`,
    },
  ];

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages,
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    const parsed = JSON.parse(textContent.text);

    // Calculate overall confidence
    const confidences = [
      parsed.clientNumber?.confidence || 0,
      parsed.policyNumber?.confidence || 0,
      parsed.documentType?.confidence || 0,
    ];
    const overallConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

    return {
      clientNumber: parsed.clientNumber || { value: null, confidence: 0 },
      policyNumber: parsed.policyNumber || { value: null, confidence: 0 },
      documentType: parsed.documentType || { value: null, confidence: 0 },
      insurer: parsed.insurer || { value: null, confidence: 0 },
      overallConfidence: Math.round(overallConfidence * 100) / 100,
    };
  } catch (error) {
    console.error("Claude extraction error:", error);
    return {
      clientNumber: { value: null, confidence: 0 },
      policyNumber: { value: null, confidence: 0 },
      documentType: { value: null, confidence: 0 },
      insurer: { value: null, confidence: 0 },
      overallConfidence: 0,
    };
  }
}

export async function extractFromPDF(
  pdfBase64: string,
  emailSubject?: string
): Promise<ExtractionResult> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: pdfBase64,
          },
        },
        {
          type: "text",
          text: `${EXTRACTION_PROMPT}${emailSubject ? `\n\nEmail Subject: "${emailSubject}"` : ""}`,
        },
      ],
    },
  ];

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages,
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    const parsed = JSON.parse(textContent.text);

    const confidences = [
      parsed.clientNumber?.confidence || 0,
      parsed.policyNumber?.confidence || 0,
      parsed.documentType?.confidence || 0,
    ];
    const overallConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

    return {
      clientNumber: parsed.clientNumber || { value: null, confidence: 0 },
      policyNumber: parsed.policyNumber || { value: null, confidence: 0 },
      documentType: parsed.documentType || { value: null, confidence: 0 },
      insurer: parsed.insurer || { value: null, confidence: 0 },
      overallConfidence: Math.round(overallConfidence * 100) / 100,
    };
  } catch (error) {
    console.error("Claude PDF extraction error:", error);
    return {
      clientNumber: { value: null, confidence: 0 },
      policyNumber: { value: null, confidence: 0 },
      documentType: { value: null, confidence: 0 },
      insurer: { value: null, confidence: 0 },
      overallConfidence: 0,
    };
  }
}
