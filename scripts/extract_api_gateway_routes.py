#!/usr/bin/env python3
"""
Extract API Gateway routes and their Lambda integrations.
Outputs to .wedding/context/api-gateway-routes.json
"""

import json
import boto3
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class APIGatewayExtractor:
    """Extract API Gateway routes and their integrations."""
    
    def __init__(self, profile: str = 'personal', region: str = 'us-west-2'):
        """Initialize the extractor with AWS credentials."""
        self.session = boto3.Session(profile_name=profile, region_name=region)
        self.api_gateway = self.session.client('apigateway')
        self.region = region
        
    def find_api_by_name(self, name_pattern: str) -> Optional[Dict[str, Any]]:
        """Find API Gateway by name pattern."""
        logger.info(f"Searching for API Gateway containing '{name_pattern}'...")
        
        try:
            response = self.api_gateway.get_rest_apis(limit=500)
            
            for api in response.get('items', []):
                if name_pattern.lower() in api['name'].lower():
                    logger.info(f"Found API: {api['name']} (ID: {api['id']})")
                    return api
                    
            logger.warning(f"No API found containing '{name_pattern}'")
            return None
            
        except Exception as e:
            logger.error(f"Error searching for API: {e}")
            return None
            
    def get_resources(self, api_id: str) -> List[Dict[str, Any]]:
        """Get all resources for an API."""
        logger.info(f"Fetching resources for API {api_id}...")
        
        try:
            response = self.api_gateway.get_resources(
                restApiId=api_id,
                limit=500
            )
            return response.get('items', [])
            
        except Exception as e:
            logger.error(f"Error fetching resources: {e}")
            return []
            
    def get_methods(self, api_id: str, resource_id: str) -> Dict[str, Any]:
        """Get all methods for a resource."""
        try:
            response = self.api_gateway.get_resource(
                restApiId=api_id,
                resourceId=resource_id
            )
            return response.get('resourceMethods', {})
            
        except Exception as e:
            logger.error(f"Error fetching methods for resource {resource_id}: {e}")
            return {}
            
    def get_integration(self, api_id: str, resource_id: str, http_method: str) -> Optional[Dict[str, Any]]:
        """Get integration details for a method."""
        try:
            response = self.api_gateway.get_integration(
                restApiId=api_id,
                resourceId=resource_id,
                httpMethod=http_method
            )
            return response
            
        except Exception as e:
            logger.error(f"Error fetching integration for {http_method} {resource_id}: {e}")
            return None
            
    def extract_lambda_arn(self, integration: Dict[str, Any]) -> Optional[str]:
        """Extract Lambda function ARN from integration URI."""
        if not integration or integration.get('type') != 'AWS_PROXY':
            return None
            
        uri = integration.get('uri', '')
        # Lambda integration URI format:
        # arn:aws:apigateway:region:lambda:path/2015-03-31/functions/arn:aws:lambda:region:account:function:name/invocations
        if 'lambda:path' in uri and '/functions/' in uri:
            start = uri.find('/functions/') + len('/functions/')
            end = uri.find('/invocations')
            if start > 0 and end > start:
                return uri[start:end]
                
        return None
        
    def extract_routes(self, api_name_pattern: str = 'heatherandwesley', default_stage: str = 'prod') -> Dict[str, Any]:
        """Extract all routes and their integrations."""
        # Find the API
        api = self.find_api_by_name(api_name_pattern)
        if not api:
            return {
                'error': f'API containing "{api_name_pattern}" not found',
                'routes': []
            }
            
        api_id = api['id']
        api_info = {
            'api_name': api['name'],
            'api_id': api_id,
            'api_type': 'REST',
            'created_date': api.get('createdDate').isoformat() if api.get('createdDate') else None,
            'description': api.get('description', ''),
            'endpoint_configuration': api.get('endpointConfiguration', {}),
            'routes': []
        }
        
        # Get deployment info
        try:
            deployments = self.api_gateway.get_deployments(restApiId=api_id, limit=500)
            stages = self.api_gateway.get_stages(restApiId=api_id)
            
            api_info['deployments'] = [
                {
                    'id': d['id'],
                    'created_date': d.get('createdDate').isoformat() if d.get('createdDate') else None,
                    'description': d.get('description', '')
                }
                for d in deployments.get('items', [])
            ]
            
            api_info['stages'] = [
                {
                    'name': s['stageName'],
                    'deployment_id': s.get('deploymentId'),
                    'invoke_url': f"https://{api_id}.execute-api.{self.region}.amazonaws.com/{s['stageName']}",
                    'description': s.get('description', ''),
                    'created_date': s.get('createdDate').isoformat() if s.get('createdDate') else None,
                    'last_updated_date': s.get('lastUpdatedDate').isoformat() if s.get('lastUpdatedDate') else None
                }
                for s in stages.get('items', [])
            ]
            
            logger.info(f"Found {len(api_info['deployments'])} deployments and {len(api_info['stages'])} stages")
            
            # If no stages found but deployments exist, add default stage
            if not api_info['stages'] and api_info['deployments'] and default_stage:
                logger.info(f"No stages found via API, adding default stage '{default_stage}'")
                api_info['stages'] = [{
                    'name': default_stage,
                    'deployment_id': api_info['deployments'][0]['id'] if api_info['deployments'] else None,
                    'invoke_url': f"https://{api_id}.execute-api.{self.region}.amazonaws.com/{default_stage}",
                    'description': 'Default stage (inferred)',
                    'created_date': None,
                    'last_updated_date': None
                }]
            
        except Exception as e:
            logger.warning(f"Could not fetch deployment/stage info: {e}")
            api_info['deployments'] = []
            api_info['stages'] = []
        
        # Get all resources
        resources = self.get_resources(api_id)
        logger.info(f"Found {len(resources)} resources")
        
        # Process each resource
        for resource in resources:
            resource_id = resource['id']
            path = resource.get('path', '')
            
            # Get methods for this resource
            methods = self.get_methods(api_id, resource_id)
            
            for http_method, method_info in methods.items():
                logger.info(f"Processing {http_method} {path}")
                
                # Get integration details
                integration = self.get_integration(api_id, resource_id, http_method)
                
                route_info = {
                    'route_key': f"{http_method} {path}",
                    'path': path,
                    'http_method': http_method,
                    'resource_id': resource_id,
                    'authorization_type': method_info.get('authorizationType', 'NONE'),
                    'api_key_required': method_info.get('apiKeyRequired', False)
                }
                
                # Add request parameters if present
                if method_info.get('requestParameters'):
                    route_info['request_parameters'] = method_info['requestParameters']
                
                if integration:
                    route_info['integration'] = {
                        'type': integration.get('type'),
                        'http_method': integration.get('httpMethod'),
                        'uri': integration.get('uri'),
                        'connection_type': integration.get('connectionType'),
                        'content_handling': integration.get('contentHandling')
                    }
                    
                    # Add integration request parameters if present
                    if integration.get('requestParameters'):
                        route_info['integration']['request_parameters'] = integration['requestParameters']
                    
                    # Extract Lambda ARN if present
                    lambda_arn = self.extract_lambda_arn(integration)
                    if lambda_arn:
                        route_info['integration']['lambda_arn'] = lambda_arn
                        
                        # Extract function name from ARN
                        if ':function:' in lambda_arn:
                            function_name = lambda_arn.split(':function:')[1].split(':')[0]
                            route_info['integration']['lambda_function_name'] = function_name
                            
                api_info['routes'].append(route_info)
                
        # Sort routes by path and method
        api_info['routes'].sort(key=lambda r: (r['path'], r['http_method']))
        
        logger.info(f"Extracted {len(api_info['routes'])} routes")
        return api_info
        
    def save_to_file(self, data: Dict[str, Any], output_path: str):
        """Save extracted data to JSON file."""
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2, default=str)
            
        logger.info(f"Saved route data to {output_file}")


def main():
    """Main function to extract API Gateway routes."""
    extractor = APIGatewayExtractor(profile='personal', region='us-west-2')
    
    # Extract routes
    route_data = extractor.extract_routes('heatherandwesley')
    
    # Add metadata
    route_data['extracted_at'] = datetime.utcnow().isoformat()
    route_data['extractor_version'] = '1.0.0'
    
    # Save to file
    output_path = '.wedding/context/api-gateway-routes.json'
    extractor.save_to_file(route_data, output_path)
    
    # Print summary
    if 'error' not in route_data:
        print(f"\nAPI Gateway Route Summary:")
        print(f"  API Name: {route_data['api_name']}")
        print(f"  API ID: {route_data['api_id']}")
        print(f"  API Type: {route_data['api_type']}")
        print(f"  Total Routes: {len(route_data['routes'])}")
        
        if route_data.get('stages'):
            print(f"\n  Stages:")
            for stage in route_data['stages']:
                print(f"    - {stage['name']}: {stage['invoke_url']}")
        
        print(f"\n  Routes:")
        for route in route_data['routes']:
            integration_type = route.get('integration', {}).get('type', 'N/A')
            lambda_name = route.get('integration', {}).get('lambda_function_name', '')
            
            if lambda_name:
                print(f"    - {route['route_key']} -> Lambda: {lambda_name}")
            else:
                print(f"    - {route['route_key']} -> {integration_type}")
                
        print(f"\n  Output saved to: {output_path}")
    else:
        print(f"Error: {route_data['error']}")


if __name__ == '__main__':
    main()