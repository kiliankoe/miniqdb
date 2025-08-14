"use client";

import { Box, Divider, Typography } from "@mui/material";
import { orange } from "@mui/material/colors";

export function NewSinceDivider() {
  return (
    <Box sx={{ my: 4, position: "relative" }}>
      <Divider sx={{ borderColor: orange[700], borderWidth: 1 }} />
      <Typography
        variant="caption"
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "background.paper",
          px: 2,
          color: orange[700],
          fontWeight: 600,
        }}
      >
        new since last visit
      </Typography>
    </Box>
  );
}
