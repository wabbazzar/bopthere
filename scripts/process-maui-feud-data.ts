import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Question text mapping (snake_case to human-readable)
const QUESTION_TEXT_MAP: Record<string, string> = {
  'foods_with_peanut_butter': 'Name something people eat with peanut butter',
  'get_rid_of_fast': 'After a crime, name something you need to get rid of fast',
  'partner_love': 'My partner is a love _____',
  'bad_boss_traits': 'Name a bad boss trait',
  'gets_passed_around': 'Name something that gets passed around',
  'people_kick': 'Name something people kick',
  'something_you_beat': 'Name something you beat',
  'office_item_teeth': 'Name an office item you might use to get food out of your teeth',
  'partner_like_steak': 'How is your partner like a steak?',
  'romantic_bath': 'What makes a bath romantic?',
  'gets_pumped_up': 'Name something that gets pumped up',
  'doctor_pulls_out': 'Name something a doctor pulls out',
  'last_kiss': 'Describe your last kiss in one word',
  'full_of_holes': 'Name something that is full of holes',
  'no_toilet_paper': 'What do you do when you run out of toilet paper?',
  'creepy_cat_behavior': 'Name a cat behavior that would be creepy if a person did it',
  'mom_question': 'Name a question your mom always asks',
  'at_100_saturday_night': 'What will you do on a Saturday night at 100 years old?',
  'once_a_week': 'Name something people do once a week',
};

interface ProcessedAnswer {
  text: string;
  count: number;
}

interface ProcessedQuestion {
  id: string;
  text: string;
  answers: ProcessedAnswer[];
}

interface ClusterData {
  normalized_value: string;
  count: number;
}

interface QuestionClusters {
  [key: string]: ClusterData;
}

function processGameData(): void {
  // Load raw questionnaire data
  const rawDataPath = path.join(__dirname, '../data/questionnaire_clustering_with_outliers.json');
  const rawData = JSON.parse(fs.readFileSync(rawDataPath, 'utf-8'));
  const questions = Object.entries(rawData.clustering_analysis.clusters_by_question);

  // Step 1: Rank questions by sum of top 3 cluster counts
  const rankedQuestions = questions
    .map(([id, clusters]: [string, QuestionClusters]) => {
      const clusterCounts = Object.entries(clusters)
        .filter(([key]) => key !== 'outliers')
        .map(([_, cluster]: [string, ClusterData]) => cluster.count)
        .sort((a, b) => b - a);

      const top3Sum = clusterCounts.slice(0, 3).reduce((sum, count) => sum + count, 0);
      return { id, clusters, top3Sum };
    })
    .sort((a, b) => b.top3Sum - a.top3Sum)
    .slice(0, 12); // Take top 12 questions

  // Step 2: Process answers - include ALL clusters where count >= 2
  const processedQuestions: ProcessedQuestion[] = rankedQuestions.map(({ id, clusters }) => {
    const answers = Object.entries(clusters)
      .filter(([key, cluster]: [string, ClusterData]) => {
        return key !== 'outliers' && cluster.count >= 2;
      })
      .map(([_, cluster]: [string, ClusterData]) => ({
        text: cluster.normalized_value,
        count: cluster.count,
      }))
      .sort((a, b) => b.count - a.count); // Sort by count descending

    return {
      id,
      text: QUESTION_TEXT_MAP[id] || id,
      answers,
    };
  });

  // Step 3: Write processed data to file
  const outputPath = path.join(__dirname, '../src/data/maui_feud_questions.json');
  const outputDir = path.dirname(outputPath);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    outputPath,
    JSON.stringify({ questions: processedQuestions }, null, 2),
    'utf-8'
  );

  console.log(`✅ Processed ${processedQuestions.length} questions`);
  processedQuestions.forEach((q, i) => {
    console.log(`   ${i + 1}. ${q.text} (${q.answers.length} answers)`);
  });
}

processGameData();
