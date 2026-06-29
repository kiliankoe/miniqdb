import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRandomQuotes, useSubmitQuote } from "@/lib/queries";
import { Box, Button, TextField, Typography } from "@mui/material";
import { orange } from "@mui/material/colors";
import { Fragment, useState } from "react";

export const Route = createFileRoute("/_authenticated/submit")({
  component: SubmitPage,
});

function SubmitPage() {
  const navigate = useNavigate();
  const [newQuote, setNewQuote] = useState("");
  const submitMutation = useSubmitQuote();
  const { data: examples } = useRandomQuotes(3);

  const handleSubmit = async () => {
    if (newQuote.length < 5 || submitMutation.isPending) return;
    submitMutation.mutate(newQuote, {
      onSuccess: () => navigate({ to: "/" }),
    });
  };

  return (
    <Box
      component="form"
      onSubmit={async (e) => {
        e.preventDefault();
        await handleSubmit();
      }}
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        mt: 4,
        maxWidth: "600px",
      }}
    >
      <TextField
        name="quote"
        value={newQuote}
        onChange={(e) => setNewQuote(e.target.value)}
        onKeyDown={async (e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            await handleSubmit();
          }
        }}
        multiline
        rows={4}
        variant="outlined"
        sx={{
          "& .MuiOutlinedInput-root": {
            bgcolor: (theme) =>
              theme.palette.mode === "dark" ? "grey.900" : "grey.100",
            "&.Mui-focused fieldset": {
              borderColor: orange[700],
            },
          },
        }}
      />
      <Button
        type="submit"
        variant="contained"
        disableElevation
        disabled={newQuote.length < 5 || submitMutation.isPending}
        sx={{
          width: { md: "256px" },
          backgroundColor: orange[700],
          color: "white",
        }}
      >
        {submitMutation.isPending ? "Submitting..." : "Submit"}
      </Button>

      <Typography
        variant="body2"
        color="text.secondary"
        component="div"
        sx={{ paddingTop: 2 }}
      >
        Examples:
        <ul style={{ listStyleType: "disc", paddingLeft: 14, paddingTop: 6 }}>
          {examples?.map((quote) => (
            <li key={quote.id}>
              <Typography variant="body2" color="text.secondary">
                {quote.text.split("\n").map((line, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: derived from a static string split, won't reorder
                  <Fragment key={i}>
                    {line}
                    <br />
                  </Fragment>
                ))}
              </Typography>
            </li>
          ))}
        </ul>
      </Typography>
    </Box>
  );
}
