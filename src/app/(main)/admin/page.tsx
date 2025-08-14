"use client";

import { Loading } from "@/components/Loading";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  Box,
  Button,
  Checkbox,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { orange } from "@mui/material/colors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Webhook {
  id: number;
  url: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [error, setError] = useState("");
  const { isAdmin, isLoading: isCheckingAdmin } = useIsAdmin();

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: async () => {
      const res = await fetch("/api/webhooks");
      if (!res.ok) throw new Error("Failed to fetch webhooks");
      return res.json();
    },
    enabled: isAdmin === true,
  });

  const addWebhookMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error("Failed to add webhook");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setNewWebhookUrl("");
      setError("");
    },
    onError: (_err) => {
      setError("Failed to add webhook");
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/webhooks/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete webhook");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });

  const toggleWebhookMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const res = await fetch(`/api/webhooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error("Failed to update webhook");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });

  useEffect(() => {
    if (!isCheckingAdmin && !isAdmin) {
      router.push("/");
    }
  }, [isAdmin, isCheckingAdmin, router]);

  if (isCheckingAdmin || isLoading) {
    return <Loading />;
  }

  if (!isAdmin) {
    return null;
  }

  const handleAddWebhook = () => {
    if (!newWebhookUrl) {
      setError("Please enter a webhook URL");
      return;
    }
    try {
      new URL(newWebhookUrl);
    } catch {
      setError("Please enter a valid URL");
      return;
    }
    addWebhookMutation.mutate(newWebhookUrl);
  };

  return (
    <Stack spacing={3}>
      <Stack spacing={2}>
        <Typography
          variant="body1"
          sx={{
            fontFamily: "monospace",
            color: "text.primary",
          }}
        >
          Webhook Configuration
        </Typography>

        <Typography
          variant="body2"
          sx={{
            fontFamily: "monospace",
            color: "text.secondary",
          }}
        >
          Configure webhooks that will be triggered when new quotes are added.
        </Typography>

        <Stack direction="row" spacing={1} alignItems="flex-start">
          <TextField
            fullWidth
            placeholder="https://example.com/webhook"
            value={newWebhookUrl}
            onChange={(e) => {
              setNewWebhookUrl(e.target.value);
              setError("");
            }}
            error={!!error}
            helperText={error}
            size="small"
            sx={{
              "& .MuiOutlinedInput-root": {
                fontFamily: "monospace",
                "&.Mui-focused fieldset": {
                  borderColor: orange[700],
                },
              },
              "& .MuiFormHelperText-root": {
                fontFamily: "monospace",
              },
            }}
          />
          <Button
            variant="contained"
            onClick={handleAddWebhook}
            disabled={addWebhookMutation.isPending}
            sx={{
              backgroundColor: orange[700],
              color: "white",
              fontFamily: "monospace",
              textTransform: "none",
              boxShadow: "none",
              "&:hover": {
                backgroundColor: orange[800],
                boxShadow: "none",
              },
            }}
          >
            Add
          </Button>
        </Stack>

        {webhooks && webhooks.length > 0 ? (
          <Stack spacing={1}>
            {webhooks.map((webhook: Webhook) => (
              <Stack
                key={webhook.id}
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{
                  p: 1,
                  borderRadius: 1,
                  "&:hover": {
                    backgroundColor: "action.hover",
                  },
                }}
              >
                <Checkbox
                  checked={webhook.active}
                  onChange={(e) =>
                    toggleWebhookMutation.mutate({
                      id: webhook.id,
                      active: e.target.checked,
                    })
                  }
                  size="small"
                  sx={{
                    color: orange[700],
                    "&.Mui-checked": {
                      color: orange[700],
                    },
                  }}
                />
                <Typography
                  sx={{
                    fontFamily: "monospace",
                    fontSize: "14px",
                    flex: 1,
                    color: webhook.active ? "text.primary" : "text.disabled",
                    textDecoration: webhook.active ? "none" : "line-through",
                  }}
                >
                  {webhook.url}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: "monospace",
                    color: "text.secondary",
                  }}
                >
                  {new Date(webhook.createdAt).toLocaleDateString("de-DE", {
                    year: "2-digit",
                    month: "2-digit",
                    day: "2-digit",
                  })}
                </Typography>
                <Box
                  component="button"
                  onClick={() => deleteWebhookMutation.mutate(webhook.id)}
                  sx={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    color: "text.secondary",
                    "&:hover": {
                      color: "error.main",
                    },
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </Box>
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography
            variant="body2"
            sx={{
              fontFamily: "monospace",
              color: "text.secondary",
            }}
          >
            No webhooks configured yet.
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}
