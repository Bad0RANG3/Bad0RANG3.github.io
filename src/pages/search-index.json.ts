import { getSearchDocuments } from '../lib/search';

export async function GET() {
  return new Response(JSON.stringify(await getSearchDocuments()), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
