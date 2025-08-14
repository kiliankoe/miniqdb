import { orange } from "@mui/material/colors";
import Navigation from "./Navigation";
import { Typography } from "@mui/material";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appName =
    process.env.MINIQDB_NAME === "" ? "miniqdb" : process.env.MINIQDB_NAME;
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
      {children}
    </>
  );
}
