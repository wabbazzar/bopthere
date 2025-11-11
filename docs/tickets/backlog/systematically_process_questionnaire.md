it systematically processes questionnaire_responses.json in local dir.
use the cluster definitions in /home/wesley/code/heatherandwesley/data/questionnaire_clustering_with_outliers.json
calcualte levenstein distance to each cluster for everyword
define a cutoff where no assignment is made (configurable)
generate a NEW file questionnaire_clustered.json
keep same structure of question keys e.g. "bad_boss_traits" / answer keys with normalized values (all this stays the same) but the variants, count, and response ids and "outliers"  are all systematically pulled from the questionnaire -they are not written by LLM