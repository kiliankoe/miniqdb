import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loading } from "@/components/Loading";
import {
  useIsAdmin,
  useWebhooks,
  useAddWebhook,
  useDeleteWebhook,
  useToggleWebhook,
} from "@/lib/queries";
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
import type { WebhookRecord } from "@/lib/types";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [error, setError] = useState("");
  const { data: isAdmin, isLoading: isCheckingAdmin } = useIsAdmin();
  const { data: webhooks, isLoading } = useWebhooks();
  const addMutation = useAddWebhook();
  const deleteMutation = useDeleteWebhook();
  const toggleMutation = useToggleWebhook();

  useEffect(() => {
    if (!isCheckingAdmin && !isAdmin) {
      navigate({ to: "/" });
    }
  }, [isAdmin, isCheckingAdmin, navigate]);

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
    addMutation.mutate(newWebhookUrl, {
      onSuccess: () => {
        setNewWebhookUrl("");
        setError("");
      },
      onError: () => {
        setError("Failed to add webhook");
      },
    });
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
            disabled={addMutation.isPending}
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
            {webhooks.map((webhook: WebhookRecord) => (
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
                    toggleMutation.mutate({
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
                  {new Date(webhook.created).toLocaleDateString("de-DE", {
                    year: "2-digit",
                    month: "2-digit",
                    day: "2-digit",
                  })}
                </Typography>
                <Box
                  component="button"
                  onClick={() => deleteMutation.mutate(webhook.id)}
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
