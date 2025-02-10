export async function PUT(request: Request, { params }: { params: { quoteId: string } }) {
  const { quoteId } = params;
  const { vote } = await request.json();
  console.log(quoteId, vote);
  // const quote = await getQuote(quoteId);
  // const updatedQuote = await updateQuote(quoteId, { vote });
  // return NextResponse.json(updatedQuote);
}
