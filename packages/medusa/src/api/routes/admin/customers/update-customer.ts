import {
  IsArray,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator"

import CustomerService from "../../../../services/customer"
import { EntityManager } from "typeorm"
import { FindParams } from "../../../../types/common"
import { MedusaError } from "medusa-core-utils"
import { Type } from "class-transformer"
import { defaultAdminCustomersRelations } from "."
import { validator } from "../../../../utils/validator"

/**
 * @oas [post] /admin/customers/{id}
 * operationId: "PostCustomersCustomer"
 * summary: "Update a Customer"
 * description: "Update a Customer's details."
 * x-authenticated: true
 * parameters:
 *   - (path) id=* {string} The ID of the Customer.
 *   - (query) expand {string} Comma-separated relations that should be expanded in the returned customer.
 *   - (query) fields {string} Comma-separated fields that should be retrieved in the returned customer.
 * requestBody:
 *   content:
 *     application/json:
 *       schema:
 *         $ref: "#/components/schemas/AdminPostCustomersCustomerReq"
 * x-codegen:
 *   method: update
 * x-codeSamples:
 *   - lang: JavaScript
 *     label: JS Client
 *     source: |
 *       import Medusa from "@medusajs/medusa-js"
 *       const medusa = new Medusa({ baseUrl: MEDUSA_BACKEND_URL, maxRetries: 3 })
 *       // must be previously logged in or use api token
 *       medusa.admin.customers.update(customerId, {
 *         first_name: "Dolly"
 *       })
 *       .then(({ customer }) => {
 *         console.log(customer.id);
 *       });
 *   - lang: Shell
 *     label: cURL
 *     source: |
 *       curl -X POST '{backend_url}/admin/customers/{id}' \
 *       -H 'x-medusa-access-token: {api_token}' \
 *       -H 'Content-Type: application/json' \
 *       --data-raw '{
 *           "first_name": "Dolly"
 *       }'
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 *   - jwt_token: []
 * tags:
 *   - Customers
 * responses:
 *   200:
 *     description: OK
 *     content:
 *       application/json:
 *         schema:
 *           $ref: "#/components/schemas/AdminCustomersRes"
 *   "400":
 *     $ref: "#/components/responses/400_error"
 *   "401":
 *     $ref: "#/components/responses/unauthorized"
 *   "404":
 *     $ref: "#/components/responses/not_found_error"
 *   "409":
 *     $ref: "#/components/responses/invalid_state_error"
 *   "422":
 *     $ref: "#/components/responses/invalid_request_error"
 *   "500":
 *     $ref: "#/components/responses/500_error"
 */
export default async (req, res) => {
  const { id } = req.params

  const validatedBody = await validator(AdminPostCustomersCustomerReq, req.body)
  const validatedQuery = await validator(FindParams, req.query)

  const customerService: CustomerService = req.scope.resolve("customerService")

  let customer = await customerService.retrieve(id)

  if (validatedBody.email && customer.has_account) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Email cannot be changed when the user has registered their account"
    )
  }

  const manager: EntityManager = req.scope.resolve("manager")
  await manager.transaction(async (transactionManager) => {
    return await customerService
      .withTransaction(transactionManager)
      .update(id, validatedBody)
  })

  let expandFields: string[] = []
  if (validatedQuery.expand) {
    expandFields = validatedQuery.expand.split(",")
  }

  const findConfig = {
    relations: expandFields.length
      ? expandFields
      : defaultAdminCustomersRelations,
  }

  customer = await customerService.retrieve(id, findConfig)

  res.status(200).json({ customer })
}

class Group {
  @IsString()
  id: string
}

/**
 * @schema AdminPostCustomersCustomerReq
 * type: object
 * properties:
 *   email:
 *     type: string
 *     description: The Customer's email. You can't update the email of a registered customer.
 *     format: email
 *   first_name:
 *     type: string
 *     description:  The Customer's first name.
 *   last_name:
 *     type: string
 *     description:  The Customer's last name.
 *   phone:
 *     type: string
 *     description: The Customer's phone number.
 *   password:
 *     type: string
 *     description: The Customer's password.
 *     format: password
 *   groups:
 *     type: array
 *     description: A list of customer groups to which the customer belongs.
 *     items:
 *       type: object
 *       required:
 *         - id
 *       properties:
 *         id:
 *           description: The ID of a customer group
 *           type: string
 *   metadata:
 *     description: An optional set of key-value pairs to hold additional information.
 *     type: object
 *     externalDocs:
 *       description: "Learn about the metadata attribute, and how to delete and update it."
 *       url: "https://docs.medusajs.com/development/entities/overview#metadata-attribute"
 */
export class AdminPostCustomersCustomerReq {
  @IsEmail()
  @IsOptional()
  email?: string

  @IsString()
  @IsOptional()
  first_name?: string

  @IsString()
  @IsOptional()
  last_name?: string

  @IsString()
  @IsOptional()
  password?: string

  @IsString()
  @IsOptional()
  phone?: string

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>

  @IsArray()
  @IsOptional()
  @Type(() => Group)
  @ValidateNested({ each: true })
  groups?: Group[]
}
