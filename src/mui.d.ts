import "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    upvote: Palette["primary"];
    downvote: Palette["primary"];
  }
  interface PaletteOptions {
    upvote?: PaletteOptions["primary"];
    downvote?: PaletteOptions["primary"];
  }
}

// needed to make this a module
export {};
