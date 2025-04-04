"use client";

import { Box, Button, TextField, Typography } from "@mui/material";
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
          backgroundColor: orange[700],
          color: "white",
        }}
      >
        Submit
      </Button>

      <Typography variant="body2" color="text.secondary" component="div" sx={{ paddingTop: 2 }}>
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
              Vincent: &quot;Maybe I should just check in the morning if I’m stupid or not.&quot;<br />
              Shyam: &quot;Most likely that will be the case.&quot;
            </Typography>
          </li>
        </ul>
      </Typography>
    </Box>
  );
}
