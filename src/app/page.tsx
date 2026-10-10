import { HomeExperience } from "@/components/home/home-experience";
import { getChapters } from "@/lib/chapters/loader";

export const dynamic = "force-static";

export default async function HomePage() {
  const chapters = await getChapters();
  return <HomeExperience chapters={chapters} />;
}
