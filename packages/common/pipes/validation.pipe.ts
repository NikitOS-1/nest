import { Optional } from '../decorators';
import { Injectable } from '../decorators/core';
import {
  ArgumentMetadata,
  BadRequestException,
  ValidationError,
} from '../index';
import { ValidatorOptions } from '../interfaces/external/validator-options.interface';
import { PipeTransform } from '../interfaces/features/pipe-transform.interface';
import { loadPackage } from '../utils/load-package.util';
import { isNil } from '../utils/shared.utils';

export interface ValidationPipeOptions extends ValidatorOptions {
  transform?: boolean;
  disableErrorMessages?: boolean;
  exceptionFactory?: (errors: ValidationError[]) => any;
}

let classValidator: any = {};
let classTransformer: any = {};

@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  protected isTransformEnabled: boolean;
  protected isDetailedOutputDisabled?: boolean;
  protected validatorOptions: ValidatorOptions;
  protected exceptionFactory: (errors: ValidationError[]) => any;

  constructor(@Optional() options?: ValidationPipeOptions) {
    options = options || {};
    const { transform, disableErrorMessages, ...validatorOptions } = options;
    this.isTransformEnabled = !!transform;
    this.validatorOptions = validatorOptions;
    this.isDetailedOutputDisabled = disableErrorMessages;
    this.exceptionFactory =
      options.exceptionFactory ||
      (errors =>
        new BadRequestException(
          this.isDetailedOutputDisabled ? undefined : errors,
        ));

    const loadPkg = (pkg: any) => loadPackage(pkg, 'ValidationPipe');
    classValidator = loadPkg('class-validator');
    classTransformer = loadPkg('class-transformer');
  }

  public async transform(value: any, metadata: ArgumentMetadata) {
    const { metatype } = metadata;
    if (!metatype || !this.toValidate(metadata)) {
      return value;
    }
    const entity = classTransformer.plainToClass(
      metatype,
      this.toEmptyIfNil(value),
    );
    const errors = await classValidator.validate(entity, this.validatorOptions);
    if (errors.length > 0) {
      throw this.exceptionFactory(errors);
    }
    return this.isTransformEnabled
      ? entity
      : Object.keys(this.validatorOptions).length > 0
        ? classTransformer.classToPlain(entity)
        : value;
  }

  private toValidate(metadata: ArgumentMetadata): boolean {
    const { metatype, type } = metadata;
    if (type === 'custom') {
      return false;
    }
    const types = [String, Boolean, Number, Array, Object];
    return !types.some(t => metatype === t) && !isNil(metatype);
  }

  toEmptyIfNil<T = any, R = any>(value: T): R | {} {
    return isNil(value) ? {} : value;
  }
}
