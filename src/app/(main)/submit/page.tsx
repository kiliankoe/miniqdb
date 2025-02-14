"use client";

import { Box, Button, TextField } from "@mui/material";
import { orange } from "@mui/material/colors";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewQuotePage() {
  return <AddForm />;
}

function AddForm() {
  const router = useRouter();
  const session = useSession();
  const [newQuote, setNewQuote] = useState("");

  const randomQuote = "random quote";

  return (
    <Box
      component="form"
      onSubmit={async (e) => {
        e.preventDefault();
        await fetch("/api/quotes", {
          method: "POST",
          body: JSON.stringify({ quote: newQuote, author: session.data?.user?.email }),
        });
        router.push("/");
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
        placeholder={randomQuote}
        value={newQuote}
        onChange={(e) => setNewQuote(e.target.value)}
        multiline
        rows={4}
        variant="outlined"
        sx={{
          "& .MuiOutlinedInput-root": {
            bgcolor: (theme) => (theme.palette.mode === "dark" ? "grey.900" : "grey.100"),
          },
        }}
      />
      <Button
        type="submit"
        variant="contained"
        disableElevation
        disabled={newQuote.length < 5}
        sx={{
          width: { md: "256px" },
          bgcolor: (theme) => (theme.palette.mode === "dark" ? orange[700] : orange[500]),
          "&:hover": {
            bgcolor: (theme) => (theme.palette.mode === "dark" ? orange[800] : orange[600]),
          },
        }}
      >
        Submit
      </Button>
    </Box>
  );
}
