"use client";

import type { QuoteResponse } from "@/app/api/quotes/QuoteResponse";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { orange } from "@mui/material/colors";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import React, { useState } from "react";
import { VoteView } from "./VoteView";

function parseMarkdownLinks(text: string) {
  return text.split(/(\[.*?\]\(.*?\))/).map((segment, j) => {
    const linkMatch = segment.match(/\[(.*?)\]\((.*?)\)/);
    if (linkMatch) {
      const [, text, url] = linkMatch;
      return (
        <a key={j} href={url} target="_blank" rel="noopener noreferrer">
          {text}
        </a>
      );
    }
    return segment;
  });
}

export function QuoteView({
  quote,
  isAdmin,
}: {
  quote: QuoteResponse;
  isAdmin?: boolean;
}) {
  const createdAt = new Date(quote.createdAt);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(quote.text || "");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (newText: string) => {
      const response = await fetch(`/api/quotes/${quote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newText }),
      });
      if (!response.ok) {
        throw new Error("Failed to update quote");
      }
      return response.json();
    },
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(editedText);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedText(quote.text || "");
  };

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/quotes/${quote.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete quote");
      }
      return response.json();
    },
    onSuccess: () => {
      setDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      if (window.location.pathname === `/${quote.id}`) {
        window.location.href = "/";
      }
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  return (
    <Stack
      direction="column"
      spacing={0}
      maxWidth={{
        xs: "100%",
        sm: "90%",
        md: "80%",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Link href={`/${quote.id}`}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              fontFamily: "monospace",
              textDecoration: "none",
              textUnderlineOffset: 1,
              textDecorationColor: "white",
            }}
          >
            {createdAt.toLocaleString("de-DE", {
              year: "2-digit",
              month: "2-digit",
              day: "2-digit",
            })}
          </Typography>
        </Link>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <VoteView score={quote.score} vote={quote.vote} quoteId={quote.id} />
          {isAdmin && !isEditing && (
            <>
              <IconButton
                size="small"
                onClick={() => setIsEditing(true)}
                sx={{ color: "text.secondary" }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setDeleteDialogOpen(true)}
                sx={{ color: "text.secondary" }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </>
          )}
        </Box>
      </Stack>
      {isEditing ? (
        <Box sx={{ mt: 1 }}>
          <TextField
            fullWidth
            multiline
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            sx={{
              mb: 1,
              "& .MuiOutlinedInput-root": {
                "&.Mui-focused fieldset": {
                  borderColor: orange[700],
                },
              },
            }}
          />
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              size="small"
              variant="contained"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              sx={{
                backgroundColor: orange[700],
                color: "white",
                "&:hover": {
                  backgroundColor: orange[800],
                },
              }}
            >
              Save
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={handleCancel}
              disabled={updateMutation.isPending}
              sx={{
                color: orange[700],
              }}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      ) : (
        <div>
          {quote.text?.split("\n").map((line, i) => (
            <React.Fragment key={i}>
              {parseMarkdownLinks(line)}
              <br />
            </React.Fragment>
          ))}
        </div>
      )}

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">Delete Quote?</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete this quote? This action cannot be
            undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            sx={{ color: "text.primary" }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            autoFocus
            disabled={deleteMutation.isPending}
            sx={{
              color: orange[700],
              "&:hover": {
                backgroundColor: "rgba(251, 140, 0, 0.04)",
              },
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
