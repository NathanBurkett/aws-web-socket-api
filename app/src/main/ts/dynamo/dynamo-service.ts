import { AttributeValue as IncompatibleAttributeValue } from 'aws-lambda';
import { AttributeValue as CompatibleAttributeValue } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

export class DynamoDbService {
    /**
     * Unmarshal DynamoDB object syntax to standard object type
     */
    public static unmarshalDynamoDBRecordImage(image: { [key: string]: IncompatibleAttributeValue }): Record<string, unknown> {
        /**
         * {@link DynamoDBRecord.dynamodb.NewImage} has { [key: string]: AttributeValue } type from aws-lambda
         * dependency. {@link unmarshall()} uses { [key: string]: AttributeValue } from @aws-sdk/util-dynamodb.
         * The two are incompatible from a typing, but not a functional, level because the latter uses
         * non-nullable, concrete {@link AttributeValue} values. Simple type cast fixes the issue but skirts
         * type checking. Functionality is covered in tests and should be a canary for anything changing under
         * explicit type cast. Long-term we may want to do a valid type conversion
         */
        return unmarshall(image as { [key: string]: CompatibleAttributeValue });
    }
}
