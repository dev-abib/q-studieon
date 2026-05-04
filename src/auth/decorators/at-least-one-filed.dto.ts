import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function AtLeastOneField(
  extraValues?: () => unknown[], // ← for file fields
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'AtLeastOneField',
      target: object.constructor,
      propertyName,
      constraints: [],
      options: {
        message: 'At least one field must be provided',
        ...validationOptions,
      },
      validator: {
        validate(_: unknown, args: ValidationArguments): boolean {
          const obj = args.object as Record<string, unknown>;
          const hasBodyField = Object.keys(obj).some(
            (key) =>
              obj[key] !== undefined && obj[key] !== null && obj[key] !== '',
          );
          const hasExtraField = extraValues
            ? extraValues().some((v) => v !== undefined && v !== null)
            : false;

          return hasBodyField || hasExtraField;
        },
        defaultMessage(): string {
          return 'At least one field must be provided';
        },
      },
    });
  };
}
