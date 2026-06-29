import { Typography } from "@mui/material";
import { orange } from "@mui/material/colors";
import { Navigation } from "./Navigation";

export function Header({ appName }: { appName: string }) {
  return (
    <>
      <Typography
        component="h1"
        sx={{
          fontSize: "20px",
          fontFamily: "monospace",
          fontWeight: 600,
          color: orange[700],
        }}
      >
        {appName}
      </Typography>
      <Navigation />
    </>
  );
}
