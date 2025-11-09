#!/usr/bin/env python3
"""
Script to systematically process questionnaire responses using cluster definitions.
Calculates Levenshtein distance to assign responses to clusters or mark as outliers.
"""

import json
import argparse
import os
from typing import Dict, List, Any

def levenshtein(s1: str, s2: str) -> int:
    """Calculate Levenshtein distance between two strings."""
    if len(s1) < len(s2):
        return levenshtein(s2, s1)

    if len(s2) == 0:
        return len(s1)

    previous_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]

def similarity_score(s1: str, s2: str) -> float:
    """Calculate a similarity score between 0 and 1, where 1 is identical."""
    if not s1 or not s2:
        return 0.0

    # Use longest common subsequence length as a better similarity measure
    def lcs_length(a: str, b: str) -> int:
        if not a or not b:
            return 0
        if a[0] == b[0]:
            return 1 + lcs_length(a[1:], b[1:])
        return max(lcs_length(a[1:], b), lcs_length(a, b[1:]))

    lcs = lcs_length(s1.lower(), s2.lower())
    max_len = max(len(s1), len(s2))
    return lcs / max_len if max_len > 0 else 0.0

def load_json_file(filepath: str) -> Dict[str, Any]:
    """Load JSON file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json_file(data: Dict[str, Any], filepath: str) -> None:
    """Save data to JSON file."""
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def process_responses(responses_data: Dict[str, Any], clustering_data: Dict[str, Any], cutoff: int) -> Dict[str, Any]:
    """Process responses and assign to clusters based on Levenshtein distance."""
    clusters_by_question = clustering_data['clustering_analysis']['clusters_by_question']
    total_responses = responses_data['metadata']['total_responses']

    result_clusters = {}

    for question_key, clusters in clusters_by_question.items():
        result_clusters[question_key] = {}
        outliers = []

        # Initialize cluster structures (skip outliers)
        for cluster_key, cluster_data in clusters.items():
            if cluster_key == 'outliers':
                continue
            result_clusters[question_key][cluster_key] = {
                'normalized_value': cluster_data['normalized_value'],
                'variants': [],
                'count': 0,
                'response_ids': []
            }

        # Process each response
        for response in responses_data['responses']:
            response_id = response['id']
            if question_key in response:
                answer = response[question_key].strip()
                if not answer:
                    continue

                # Normalize for distance calculation
                answer_norm = answer.lower()

                # Calculate similarity scores to all clusters (skip outliers)
                similarities = {}
                for cluster_key, cluster_data in clusters.items():
                    if cluster_key == 'outliers':
                        continue
                    norm_val = cluster_data['normalized_value'].lower()
                    # Full string similarity
                    sims = [similarity_score(answer_norm, norm_val)]
                    # Substring similarities for fuzzy matching
                    cluster_len = len(norm_val)
                    for sub_len in range(max(1, cluster_len - 3), cluster_len + 4):
                        for i in range(max(0, len(answer_norm) - sub_len + 1)):
                            sub = answer_norm[i:i + sub_len]
                            sims.append(similarity_score(sub, norm_val))
                    similarities[cluster_key] = max(sims)

                # Find maximum similarity
                max_sim = max(similarities.values())
                if max_sim >= 0.5:  # Require at least 50% similarity
                    # Assign to cluster with maximum similarity
                    best_cluster = max(similarities, key=similarities.get)
                    result_clusters[question_key][best_cluster]['variants'].append(answer)
                    result_clusters[question_key][best_cluster]['count'] += 1
                    result_clusters[question_key][best_cluster]['response_ids'].append(response_id)
                else:
                    # Add to outliers
                    outliers.append({'id': response_id, 'response': answer})

        # Add outliers to the question
        result_clusters[question_key]['outliers'] = outliers

    # Build result structure
    result = {
        'clustering_analysis': {
            'description': clustering_data['clustering_analysis']['description'],
            'total_responses': total_responses,
            'clusters_by_question': result_clusters
        },
        'summary_statistics': clustering_data['summary_statistics']  # Keep original summary
    }

    return result

def main():
    parser = argparse.ArgumentParser(description='Process questionnaire responses with clustering')
    parser.add_argument('--responses', default='tmp/questionnaire_responses.json',
                       help='Path to responses JSON file')
    parser.add_argument('--clustering', default='data/questionnaire_clustering_with_outliers.json',
                       help='Path to clustering definitions JSON file')
    parser.add_argument('--output', default='questionnaire_clustered.json',
                       help='Output file path')
    parser.add_argument('--similarity_threshold', type=float, default=0.5,
                       help='Similarity threshold for cluster assignment (default: 0.5)')

    args = parser.parse_args()

    # Load data
    responses_data = load_json_file(args.responses)
    clustering_data = load_json_file(args.clustering)

    # Process responses
    result = process_responses(responses_data, clustering_data, args.similarity_threshold)

    # Save result
    save_json_file(result, args.output)
    print(f"Processed {responses_data['metadata']['total_responses']} responses")
    print(f"Output saved to {args.output}")

if __name__ == '__main__':
    main()