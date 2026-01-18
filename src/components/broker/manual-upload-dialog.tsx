"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X } from "lucide-react";

interface ManualUploadDialogProps {
  onUploadComplete?: () => void;
}

export function ManualUploadDialog({ onUploadComplete }: ManualUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fromEmail, setFromEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
    setError(null);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError("Please select at least one file");
      return;
    }

    if (!fromEmail || !subject) {
      setError("Please provide email sender and subject");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("fromEmail", fromEmail);
      formData.append("subject", subject);

      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/broker/email-inbox/manual-upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      // Reset form
      setSelectedFiles([]);
      setFromEmail("");
      setSubject("");
      setOpen(false);

      // Notify parent
      onUploadComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          Upload Document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manual Document Upload</DialogTitle>
          <DialogDescription>
            Upload documents manually without email forwarding. This creates an email transaction
            for AI processing and broker review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="fromEmail">From Email *</Label>
            <Input
              id="fromEmail"
              type="email"
              placeholder="insurer@example.com"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              disabled={isUploading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              placeholder="Policy Schedule - John Smith"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isUploading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="files">Attachments *</Label>
            <Input
              id="files"
              type="file"
              accept=".pdf,.doc,.docx"
              multiple
              onChange={handleFileChange}
              disabled={isUploading}
            />
            <p className="text-xs text-muted-foreground">
              Accepted formats: PDF, DOC, DOCX
            </p>
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Files ({selectedFiles.length})</Label>
              <div className="space-y-1">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded-md text-sm"
                  >
                    <span className="truncate flex-1">
                      {file.name} ({Math.round(file.size / 1024)} KB)
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      disabled={isUploading}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={isUploading}>
            {isUploading ? "Uploading..." : "Upload & Process"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
