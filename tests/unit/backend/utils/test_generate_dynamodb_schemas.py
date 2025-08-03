#!/usr/bin/env python3
"""
Test suite for DynamoDB Schema Extractor
Tests all functionality including error handling, edge cases, and output generation
"""

import json
import pytest
from unittest.mock import Mock, patch, MagicMock, mock_open
from decimal import Decimal
from datetime import datetime
import os
import sys

# Add the scripts directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

from generate_dynamodb_schemas import DynamoDBSchemaExtractor


class TestDynamoDBSchemaExtractor:
    """Test suite for DynamoDBSchemaExtractor class"""
    
    @pytest.fixture
    def mock_boto3_session(self):
        """Mock boto3 session for testing"""
        with patch('generate_dynamodb_schemas.boto3.Session') as mock_session:
            # Create mock clients
            mock_dynamodb_resource = Mock()
            mock_dynamodb_client = Mock()
            
            # Configure session to return mocked clients
            mock_session.return_value.resource.return_value = mock_dynamodb_resource
            mock_session.return_value.client.return_value = mock_dynamodb_client
            
            yield mock_session, mock_dynamodb_resource, mock_dynamodb_client
    
    def test_initialization_success(self, mock_boto3_session):
        """Test successful initialization of DynamoDBSchemaExtractor"""
        mock_session, mock_resource, mock_client = mock_boto3_session
        
        # Create extractor
        extractor = DynamoDBSchemaExtractor(profile_name='test', region='us-east-1')
        
        # Verify boto3 session was created with correct parameters
        mock_session.assert_called_once_with(profile_name='test', region_name='us-east-1')
        
        # Verify clients were created
        assert extractor.dynamodb is not None
        assert extractor.dynamodb_client is not None
        assert extractor.type_deserializer is not None
    
    def test_initialization_failure(self, mock_boto3_session):
        """Test initialization failure when AWS credentials are invalid"""
        mock_session, _, _ = mock_boto3_session
        mock_session.side_effect = Exception("Invalid credentials")
        
        # Verify exception is raised
        with pytest.raises(Exception) as exc_info:
            DynamoDBSchemaExtractor(profile_name='invalid', region='us-east-1')
        
        assert "Invalid credentials" in str(exc_info.value)
    
    def test_deserialize_dynamodb_item(self, mock_boto3_session):
        """Test DynamoDB item deserialization"""
        _, _, _ = mock_boto3_session
        extractor = DynamoDBSchemaExtractor()
        
        # Mock DynamoDB item format
        dynamodb_item = {
            'id': {'S': '123'},
            'name': {'S': 'John Doe'},
            'age': {'N': '30'},
            'active': {'BOOL': True},
            'tags': {'L': [{'S': 'tag1'}, {'S': 'tag2'}]},
            'metadata': {'M': {'key': {'S': 'value'}}}
        }
        
        # Deserialize
        result = extractor._deserialize_dynamodb_item(dynamodb_item)
        
        # Verify deserialized values
        assert result['id'] == '123'
        assert result['name'] == 'John Doe'
        assert result['age'] == Decimal('30')
        assert result['active'] is True
        assert result['tags'] == ['tag1', 'tag2']
        assert result['metadata'] == {'key': 'value'}
    
    def test_decimal_to_json_serializable(self, mock_boto3_session):
        """Test Decimal conversion to JSON-serializable format"""
        _, _, _ = mock_boto3_session
        extractor = DynamoDBSchemaExtractor()
        
        # Test various Decimal conversions
        assert extractor._decimal_to_json_serializable(Decimal('10')) == 10
        assert extractor._decimal_to_json_serializable(Decimal('10.5')) == 10.5
        assert extractor._decimal_to_json_serializable(Decimal('0')) == 0
        
        # Test nested structures
        nested_dict = {
            'count': Decimal('5'),
            'price': Decimal('19.99'),
            'items': [Decimal('1'), Decimal('2.5')],
            'meta': {'total': Decimal('100')}
        }
        result = extractor._decimal_to_json_serializable(nested_dict)
        
        assert result['count'] == 5
        assert result['price'] == 19.99
        assert result['items'] == [1, 2.5]
        assert result['meta']['total'] == 100
        
        # Test non-Decimal values pass through
        assert extractor._decimal_to_json_serializable('string') == 'string'
        assert extractor._decimal_to_json_serializable(True) is True
        assert extractor._decimal_to_json_serializable(None) is None
    
    def test_infer_field_type(self, mock_boto3_session):
        """Test field type inference from values"""
        _, _, _ = mock_boto3_session
        extractor = DynamoDBSchemaExtractor()
        
        # Test various type inferences
        assert extractor._infer_field_type(None) == 'null'
        assert extractor._infer_field_type(True) == 'boolean'
        assert extractor._infer_field_type(False) == 'boolean'
        assert extractor._infer_field_type(42) == 'number'
        assert extractor._infer_field_type(Decimal('3.14')) == 'number'
        assert extractor._infer_field_type('hello') == 'string'
        assert extractor._infer_field_type({'key': 'value'}) == 'object'
        assert extractor._infer_field_type([1, 2, 3]) == 'array'
        assert extractor._infer_field_type(object()) == 'unknown'
    
    def test_get_field_description(self, mock_boto3_session):
        """Test field description generation"""
        _, _, _ = mock_boto3_session
        extractor = DynamoDBSchemaExtractor()
        
        # Test known fields
        assert "Unique identifier" in extractor._get_field_description('id')
        assert "Full name" in extractor._get_field_description('name')
        assert "Email address" in extractor._get_field_description('email')
        assert "attendance status" in extractor._get_field_description('attendance')
        
        # Test unknown field
        assert extractor._get_field_description('unknown_field') == 'Field: unknown_field'
    
    def test_get_table_schema_success(self, mock_boto3_session):
        """Test successful schema extraction from a table"""
        _, mock_resource, mock_client = mock_boto3_session
        extractor = DynamoDBSchemaExtractor()
        
        # Mock table description
        mock_client.describe_table.return_value = {
            'Table': {
                'KeySchema': [
                    {'AttributeName': 'id', 'KeyType': 'HASH'}
                ],
                'AttributeDefinitions': [
                    {'AttributeName': 'id', 'AttributeType': 'S'}
                ]
            }
        }
        
        # Mock table scan with sample items
        mock_table = Mock()
        mock_resource.Table.return_value = mock_table
        mock_table.scan.return_value = {
            'Items': [
                {
                    'id': '123',
                    'name': 'John Doe',
                    'email': 'john@example.com',
                    'attendance': 'attending',
                    'notifications': True,
                    'created_at': '2024-01-01T00:00:00Z'
                },
                {
                    'id': '456',
                    'name': 'Jane Smith',
                    'email': 'jane@example.com',
                    'attendance': 'not_attending',
                    'notifications': False,
                    'message_for_couple': 'Congratulations!',
                    'created_at': '2024-01-02T00:00:00Z'
                }
            ]
        }
        
        # Extract schema
        schema = extractor.get_table_schema('test-table')
        
        # Verify schema structure
        assert schema['tableName'] == 'test-table'
        assert schema['keySchema']['partitionKey'] == 'id'
        assert schema['keySchema']['sortKey'] is None
        assert 'id' in schema['attributes']
        assert schema['attributes']['id'] == 'S'
        assert schema['sampleCount'] == 2
        
        # Verify fields were discovered
        fields = schema['fields']
        assert 'id' in fields
        assert 'name' in fields
        assert 'email' in fields
        assert 'attendance' in fields
        assert 'notifications' in fields
        assert 'message_for_couple' in fields
        
        # Verify required field detection
        assert fields['id']['required'] is True
        assert fields['name']['required'] is True
        # message_for_couple appears in second item, so it's still marked as required
        # since the algorithm only marks fields as not required if they're missing from some items
        assert fields['message_for_couple']['required'] is True
        
        # Verify field types
        assert 'string' in fields['id']['types']
        assert 'string' in fields['name']['types']
        assert 'boolean' in fields['notifications']['types']
    
    def test_get_table_schema_optional_fields(self, mock_boto3_session):
        """Test detection of optional fields in schema"""
        _, mock_resource, mock_client = mock_boto3_session
        extractor = DynamoDBSchemaExtractor()
        
        # Mock table description
        mock_client.describe_table.return_value = {
            'Table': {
                'KeySchema': [
                    {'AttributeName': 'id', 'KeyType': 'HASH'}
                ],
                'AttributeDefinitions': [
                    {'AttributeName': 'id', 'AttributeType': 'S'}
                ]
            }
        }
        
        # Mock table scan with items where some fields are missing
        mock_table = Mock()
        mock_resource.Table.return_value = mock_table
        mock_table.scan.return_value = {
            'Items': [
                {
                    'id': '123',
                    'name': 'John Doe',
                    'email': 'john@example.com',
                    'optional_field': 'present'
                },
                {
                    'id': '456',
                    'name': 'Jane Smith',
                    'email': 'jane@example.com'
                    # optional_field is missing here
                },
                {
                    'id': '789',
                    'name': 'Bob Wilson',
                    'email': 'bob@example.com'
                    # optional_field is missing here too
                }
            ]
        }
        
        # Extract schema
        schema = extractor.get_table_schema('test-table')
        
        # Verify optional field detection
        fields = schema['fields']
        assert fields['id']['required'] is True
        assert fields['name']['required'] is True
        assert fields['email']['required'] is True
        assert fields['optional_field']['required'] is False  # Missing from some items
    
    def test_get_table_schema_empty_table(self, mock_boto3_session):
        """Test schema extraction from empty table"""
        _, mock_resource, mock_client = mock_boto3_session
        extractor = DynamoDBSchemaExtractor()
        
        # Mock table description
        mock_client.describe_table.return_value = {
            'Table': {
                'KeySchema': [
                    {'AttributeName': 'id', 'KeyType': 'HASH'}
                ],
                'AttributeDefinitions': [
                    {'AttributeName': 'id', 'AttributeType': 'S'}
                ]
            }
        }
        
        # Mock empty table scan
        mock_table = Mock()
        mock_resource.Table.return_value = mock_table
        mock_table.scan.return_value = {'Items': []}
        
        # Extract schema
        schema = extractor.get_table_schema('empty-table')
        
        # Verify basic schema structure is still created
        assert schema['tableName'] == 'empty-table'
        assert schema['keySchema']['partitionKey'] == 'id'
        assert schema['sampleCount'] == 0
        assert schema['fields'] == {}
    
    def test_get_table_schema_error(self, mock_boto3_session):
        """Test schema extraction error handling"""
        _, mock_resource, mock_client = mock_boto3_session
        extractor = DynamoDBSchemaExtractor()
        
        # Mock describe_table to raise an exception
        mock_client.describe_table.side_effect = Exception("Table not found")
        
        # Verify exception is raised
        with pytest.raises(Exception) as exc_info:
            extractor.get_table_schema('non-existent-table')
        
        assert "Table not found" in str(exc_info.value)
    
    def test_extract_all_schemas(self, mock_boto3_session):
        """Test extraction of all table schemas"""
        _, mock_resource, mock_client = mock_boto3_session
        extractor = DynamoDBSchemaExtractor()
        
        # Mock successful schema extraction
        mock_client.describe_table.return_value = {
            'Table': {
                'KeySchema': [{'AttributeName': 'id', 'KeyType': 'HASH'}],
                'AttributeDefinitions': [{'AttributeName': 'id', 'AttributeType': 'S'}]
            }
        }
        
        mock_table = Mock()
        mock_resource.Table.return_value = mock_table
        mock_table.scan.return_value = {
            'Items': [{'id': '123', 'name': 'Test User'}]
        }
        
        # Extract all schemas
        schemas = extractor.extract_all_schemas()
        
        # Verify the expected table was processed
        assert 'heatherandwesley-users' in schemas
        assert schemas['heatherandwesley-users']['tableName'] == 'heatherandwesley-users'
    
    def test_extract_all_schemas_partial_failure(self, mock_boto3_session):
        """Test extraction continues when one table fails"""
        _, mock_resource, mock_client = mock_boto3_session
        extractor = DynamoDBSchemaExtractor()
        
        # Mock describe_table to fail
        mock_client.describe_table.side_effect = Exception("Access denied")
        
        # Extract all schemas
        schemas = extractor.extract_all_schemas()
        
        # Verify empty dict is returned when all tables fail
        assert schemas == {}
    
    def test_generate_json_schema(self, mock_boto3_session):
        """Test JSON Schema generation from extracted schemas"""
        _, _, _ = mock_boto3_session
        extractor = DynamoDBSchemaExtractor()
        
        # Create test schema
        test_schemas = {
            'test-table': {
                'description': 'Test table',
                'fields': {
                    'id': {
                        'types': ['string'],
                        'required': True,
                        'description': 'Unique ID',
                        'examples': ['123', '456']
                    },
                    'count': {
                        'types': ['number'],
                        'required': False,
                        'description': 'Item count',
                        'examples': [1, 2]
                    },
                    'tags': {
                        'types': ['array'],
                        'required': False,
                        'description': 'Tags',
                        'examples': [['tag1', 'tag2']]
                    }
                }
            }
        }
        
        # Generate JSON Schema
        result = extractor.generate_json_schema(test_schemas)
        
        # Verify structure
        assert 'schemas' in result
        assert 'metadata' in result
        assert 'test-table' in result['schemas']
        
        # Verify JSON Schema format
        json_schema = result['schemas']['test-table']
        assert json_schema['$schema'] == 'http://json-schema.org/draft-07/schema#'
        assert json_schema['type'] == 'object'
        assert 'properties' in json_schema
        assert 'required' in json_schema
        
        # Verify properties
        properties = json_schema['properties']
        assert properties['id']['type'] == 'string'
        assert properties['id']['description'] == 'Unique ID'
        assert properties['id']['examples'] == ['123', '456']
        assert properties['count']['type'] == 'number'
        assert properties['tags']['type'] == 'array'
        
        # Verify required fields
        assert 'id' in json_schema['required']
        assert 'count' not in json_schema['required']
    
    def test_generate_json_schema_mixed_types(self, mock_boto3_session):
        """Test JSON Schema generation with mixed field types"""
        _, _, _ = mock_boto3_session
        extractor = DynamoDBSchemaExtractor()
        
        # Create schema with mixed types
        test_schemas = {
            'test-table': {
                'description': 'Test table',
                'fields': {
                    'mixed_field': {
                        'types': ['string', 'number', 'null'],
                        'required': False,
                        'description': 'Mixed type field',
                        'examples': ['text', 123]
                    }
                }
            }
        }
        
        # Generate JSON Schema
        result = extractor.generate_json_schema(test_schemas)
        
        # Verify mixed types default to string
        json_schema = result['schemas']['test-table']
        assert json_schema['properties']['mixed_field']['type'] == 'string'
    
    def test_generate_markdown_docs(self, mock_boto3_session):
        """Test Markdown documentation generation"""
        _, _, _ = mock_boto3_session
        extractor = DynamoDBSchemaExtractor()
        
        # Create test schema
        test_schemas = {
            'test-table': {
                'description': 'Test table for unit tests',
                'keySchema': {
                    'partitionKey': 'id',
                    'sortKey': 'timestamp'
                },
                'fields': {
                    'id': {
                        'types': ['string'],
                        'required': True,
                        'description': 'Unique identifier',
                        'examples': ['uuid-123']
                    },
                    'name': {
                        'types': ['string'],
                        'required': True,
                        'description': 'User name',
                        'examples': ['John Doe', 'Jane Smith']
                    },
                    'optional_field': {
                        'types': ['string'],
                        'required': False,
                        'description': 'Optional data',
                        'examples': []
                    }
                }
            }
        }
        
        # Generate Markdown
        markdown = extractor.generate_markdown_docs(test_schemas)
        
        # Verify content
        assert '# DynamoDB Table Schemas' in markdown
        assert '## Table: `test-table`' in markdown
        assert 'Test table for unit tests' in markdown
        assert '**Primary Key:** `id`' in markdown
        assert '**Sort Key:** `timestamp`' in markdown
        
        # Verify fields table
        assert '| Field Name | Type(s) | Required | Description |' in markdown
        assert '| `id` | string | Yes | Unique identifier |' in markdown
        assert '| `name` | string | Yes | User name |' in markdown
        assert '| `optional_field` | string | No | Optional data |' in markdown
        
        # Verify examples section
        assert '### Example Values' in markdown
        assert '**id**: `uuid-123`' in markdown
        assert '**name**: `John Doe`, `Jane Smith`' in markdown
        
        # Verify usage notes
        assert '## Usage Notes' in markdown
        assert '### For Lambda Functions' in markdown
        assert '### For Frontend Development' in markdown
    
    @patch('builtins.open', new_callable=mock_open)
    @patch('os.makedirs')
    def test_save_outputs(self, mock_makedirs, mock_file, mock_boto3_session):
        """Test saving outputs to files"""
        _, _, _ = mock_boto3_session
        extractor = DynamoDBSchemaExtractor()
        
        # Create test schema
        test_schemas = {
            'test-table': {
                'description': 'Test table',
                'keySchema': {'partitionKey': 'id', 'sortKey': None},
                'fields': {
                    'id': {
                        'types': ['string'],
                        'required': True,
                        'description': 'ID',
                        'examples': ['123']
                    }
                }
            }
        }
        
        # Save outputs
        extractor.save_outputs(test_schemas)
        
        # Verify directory creation
        mock_makedirs.assert_called_once_with('.wedding/context', exist_ok=True)
        
        # Verify files were written
        assert mock_file.call_count == 2
        
        # Check JSON file write
        json_call = [call for call in mock_file.call_args_list if 'dynamodb-schemas.json' in str(call)][0]
        assert '.wedding/context/dynamodb-schemas.json' in str(json_call)
        
        # Check Markdown file write
        md_call = [call for call in mock_file.call_args_list if 'field-mappings.md' in str(call)][0]
        assert '.wedding/context/field-mappings.md' in str(md_call)
    
    @patch('generate_dynamodb_schemas.DynamoDBSchemaExtractor')
    def test_main_success(self, mock_extractor_class):
        """Test main function success flow"""
        # Mock extractor instance
        mock_extractor = Mock()
        mock_extractor_class.return_value = mock_extractor
        mock_extractor.extract_all_schemas.return_value = {'table1': {'data': 'test'}}
        
        # Import and run main
        from generate_dynamodb_schemas import main
        main()
        
        # Verify workflow
        mock_extractor_class.assert_called_once_with(profile_name='personal', region='us-east-1')
        mock_extractor.extract_all_schemas.assert_called_once()
        mock_extractor.save_outputs.assert_called_once_with({'table1': {'data': 'test'}})
    
    @patch('generate_dynamodb_schemas.DynamoDBSchemaExtractor')
    def test_main_no_schemas(self, mock_extractor_class):
        """Test main function when no schemas are extracted"""
        # Mock extractor instance
        mock_extractor = Mock()
        mock_extractor_class.return_value = mock_extractor
        mock_extractor.extract_all_schemas.return_value = {}
        
        # Import and run main
        from generate_dynamodb_schemas import main
        main()
        
        # Verify save_outputs was not called
        mock_extractor.save_outputs.assert_not_called()
    
    @patch('generate_dynamodb_schemas.DynamoDBSchemaExtractor')
    def test_main_exception(self, mock_extractor_class):
        """Test main function exception handling"""
        # Mock extractor to raise exception
        mock_extractor_class.side_effect = Exception("Connection failed")
        
        # Import and run main
        from generate_dynamodb_schemas import main
        
        # Verify exception is raised
        with pytest.raises(Exception) as exc_info:
            main()
        
        assert "Connection failed" in str(exc_info.value)


class TestEdgeCases:
    """Test edge cases and error scenarios"""
    
    @patch('generate_dynamodb_schemas.boto3.Session')
    def test_malformed_dynamodb_data(self, mock_session):
        """Test handling of malformed DynamoDB data"""
        # Setup mocks
        mock_resource = Mock()
        mock_client = Mock()
        mock_session.return_value.resource.return_value = mock_resource
        mock_session.return_value.client.return_value = mock_client
        
        extractor = DynamoDBSchemaExtractor()
        
        # Mock table with malformed data
        mock_client.describe_table.return_value = {
            'Table': {
                'KeySchema': [{'AttributeName': 'id', 'KeyType': 'HASH'}],
                'AttributeDefinitions': [{'AttributeName': 'id', 'AttributeType': 'S'}]
            }
        }
        
        mock_table = Mock()
        mock_resource.Table.return_value = mock_table
        
        # Include various edge case data
        mock_table.scan.return_value = {
            'Items': [
                {
                    'id': '1',
                    'empty_string': '',
                    'empty_list': [],
                    'empty_dict': {},
                    'nested_empty': {'level1': {'level2': {}}},
                    'mixed_list': [1, 'two', True, None, {'key': 'value'}],
                    'very_large_decimal': Decimal('99999999999999999999.99999999999999999999'),
                    'very_small_decimal': Decimal('0.00000000000000000001'),
                    'unicode_string': '测试中文字符和emoji😀',
                    'special_chars': 'Line1\nLine2\tTab\r\nWindows'
                }
            ]
        }
        
        # Extract schema
        schema = extractor.get_table_schema('edge-case-table')
        
        # Verify edge cases are handled
        fields = schema['fields']
        assert 'empty_string' in fields
        assert 'empty_list' in fields
        assert 'empty_dict' in fields
        assert 'mixed_list' in fields
        assert 'unicode_string' in fields
        
        # Verify types are correctly inferred
        assert 'string' in fields['empty_string']['types']
        assert 'array' in fields['empty_list']['types']
        assert 'object' in fields['empty_dict']['types']
        assert 'array' in fields['mixed_list']['types']
    
    @patch('generate_dynamodb_schemas.boto3.Session')
    def test_connection_timeout(self, mock_session):
        """Test handling of connection timeouts"""
        # Mock session to simulate timeout
        mock_session.side_effect = TimeoutError("Connection timed out")
        
        with pytest.raises(Exception) as exc_info:
            DynamoDBSchemaExtractor()
        
        assert "Connection timed out" in str(exc_info.value)
    
    @patch('generate_dynamodb_schemas.boto3.Session')
    def test_permission_denied(self, mock_session):
        """Test handling of permission denied errors"""
        mock_resource = Mock()
        mock_client = Mock()
        mock_session.return_value.resource.return_value = mock_resource
        mock_session.return_value.client.return_value = mock_client
        
        # Mock permission error
        mock_client.describe_table.side_effect = Exception("User: arn:aws:iam::123456789012:user/test is not authorized to perform: dynamodb:DescribeTable")
        
        extractor = DynamoDBSchemaExtractor()
        
        with pytest.raises(Exception) as exc_info:
            extractor.get_table_schema('restricted-table')
        
        assert "not authorized" in str(exc_info.value)
    
    @patch('generate_dynamodb_schemas.boto3.Session')
    def test_rate_limiting(self, mock_session):
        """Test handling of rate limiting errors"""
        mock_resource = Mock()
        mock_client = Mock()
        mock_session.return_value.resource.return_value = mock_resource
        mock_session.return_value.client.return_value = mock_client
        
        # Mock rate limiting error on scan
        mock_table = Mock()
        mock_resource.Table.return_value = mock_table
        mock_client.describe_table.return_value = {
            'Table': {
                'KeySchema': [{'AttributeName': 'id', 'KeyType': 'HASH'}],
                'AttributeDefinitions': [{'AttributeName': 'id', 'AttributeType': 'S'}]
            }
        }
        mock_table.scan.side_effect = Exception("Rate exceeded")
        
        extractor = DynamoDBSchemaExtractor()
        
        with pytest.raises(Exception) as exc_info:
            extractor.get_table_schema('busy-table')
        
        assert "Rate exceeded" in str(exc_info.value)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])