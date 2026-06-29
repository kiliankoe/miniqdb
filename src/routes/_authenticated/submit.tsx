import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSubmitQuote } from "@/lib/queries";
import { Box, Button, TextField, Typography } from "@mui/material";
import { orange } from "@mui/material/colors";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/submit")({
  component: SubmitPage,
});

function SubmitPage() {
  const navigate = useNavigate();
  const [newQuote, setNewQuote] = useState("");
  const submitMutation = useSubmitQuote();

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
          <li>
            <Typography variant="body2" color="text.secondary">
              &quot;Kilian, how do I make your sausage warm?&quot; - Shawn
            </Typography>
          </li>
          <li>
            <Typography variant="body2" color="text.secondary">
              &quot;Das sind Manager, die wollen gebrochen werden.&quot; - Dirk
            </Typography>
          </li>
          <li>
            <Typography variant="body2" color="text.secondary">
              Vincent: &quot;Maybe I should just check in the morning if I'm
              stupid or not.&quot;
              <br />
              Shyam: &quot;Most likely that will be the case.&quot;
            </Typography>
          </li>
        </ul>
      </Typography>
    </Box>
  );
}
