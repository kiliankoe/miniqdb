import { useVote } from "@/lib/queries";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { IconButton, Stack, Typography } from "@mui/material";
import { blue, orange } from "@mui/material/colors";

export function VoteView({
  score,
  vote,
  quoteId,
}: {
  score: number;
  vote: number;
  quoteId: string;
}) {
  const mutation = useVote(quoteId, vote);

  const handleVote = (newVote: number) => {
    mutation.mutate(newVote);
  };

  const getVoteColor = (voteValue: number | undefined) => {
    if (voteValue === 1) return orange[400];
    if (voteValue === -1) return blue[400];
    return "text.secondary";
  };

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      justifyContent="center"
    >
      <IconButton
        onClick={() => handleVote(vote === 1 ? 0 : 1)}
        size="small"
        sx={{
          "& .MuiSvgIcon-root": {
            color: getVoteColor(vote === 1 ? 1 : undefined),
          },
        }}
      >
        <ExpandLessIcon />
      </IconButton>
      <Typography
        variant="body1"
        sx={{ fontFamily: "monospace", width: "25px", textAlign: "center" }}
      >
        {score}
      </Typography>
      <IconButton
        onClick={() => handleVote(vote === -1 ? 0 : -1)}
        size="small"
        sx={{
          "& .MuiSvgIcon-root": {
            color: getVoteColor(vote === -1 ? -1 : undefined),
          },
        }}
      >
        <ExpandMoreIcon />
      </IconButton>
    </Stack>
  );
}
