import type { QuoteWithVote } from "@/lib/types";
import { useUpdateQuote, useDeleteQuote } from "@/lib/queries";
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
import { Link, useNavigate } from "@tanstack/react-router";
import React, { useState } from "react";
import { VoteView } from "./VoteView";

function parseMarkdownLinks(text: string) {
  return text.split(/(\[.*?\]\(.*?\))/).map((segment, j) => {
    const linkMatch = segment.match(/\[(.*?)\]\((.*?)\)/);
    if (linkMatch) {
      const [, linkText, url] = linkMatch;
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: array is derived from static string split, won't reorder
        <a key={j} href={url} target="_blank" rel="noopener noreferrer">
          {linkText}
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
  quote: QuoteWithVote;
  isAdmin?: boolean;
}) {
  const createdAt = new Date(quote.created);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(quote.text);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const navigate = useNavigate();

  const updateMutation = useUpdateQuote();
  const deleteMutation = useDeleteQuote();

  const handleSave = () => {
    updateMutation.mutate(
      { id: quote.id, text: editedText },
      { onSuccess: () => setIsEditing(false) },
    );
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedText(quote.text);
  };

  const handleDelete = () => {
    deleteMutation.mutate(quote.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        if (window.location.pathname === `/${quote.shortId}`) {
          navigate({ to: "/" });
        }
      },
    });
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
        <Link to="/$quoteId" params={{ quoteId: String(quote.shortId) }}>
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
            // biome-ignore lint/suspicious/noArrayIndexKey: array is derived from static string split, won't reorder
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
