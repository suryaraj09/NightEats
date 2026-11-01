
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admin_emails": {
                  Row: {
                    "email": string
                  }
                  ComputedFields: never
                  Insert: {
                    "email": string
                  }
                  Update: {
                    "email"?: string
                  }
                  Relationships: [
                    
                  ]
                },"coupon_redemptions": {
                  Row: {
                    "coupon_id": number,"id": number,"order_id": number | null,"phone": string,"redeemed_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "coupon_id": number,"id"?: never,"order_id"?: number | null,"phone": string,"redeemed_at"?: string,"user_id": string
                  }
                  Update: {
                    "coupon_id"?: number,"id"?: never,"order_id"?: number | null,"phone"?: string,"redeemed_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "coupon_redemptions_coupon_id_fkey"
      columns: ["coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coupon_redemptions_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"coupons": {
                  Row: {
                    "applies_to": string,"bundle_price": number | null,"bundle_qty": number | null,"buy_qty": number | null,"category": string | null,"code": string,"created_at": string,"days_of_week": (number)[] | null,"description": string,"end_time": string | null,"ends_at": string | null,"first_order_only": boolean,"flat_off": number | null,"free_item_id": number | null,"free_qty": number | null,"id": number,"is_active": boolean,"item_ids": (number)[],"max_discount": number | null,"max_total_uses": number | null,"max_uses_per_phone": number | null,"max_uses_per_user": number | null,"min_order_value": number,"min_qty": number,"percent_off": number | null,"start_time": string | null,"starts_at": string | null,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "applies_to"?: string,"bundle_price"?: number | null,"bundle_qty"?: number | null,"buy_qty"?: number | null,"category"?: string | null,"code": string,"created_at"?: string,"days_of_week"?: (number)[] | null,"description"?: string,"end_time"?: string | null,"ends_at"?: string | null,"first_order_only"?: boolean,"flat_off"?: number | null,"free_item_id"?: number | null,"free_qty"?: number | null,"id"?: never,"is_active"?: boolean,"item_ids"?: (number)[],"max_discount"?: number | null,"max_total_uses"?: number | null,"max_uses_per_phone"?: number | null,"max_uses_per_user"?: number | null,"min_order_value"?: number,"min_qty"?: number,"percent_off"?: number | null,"start_time"?: string | null,"starts_at"?: string | null,"type": string
                  }
                  Update: {
                    "applies_to"?: string,"bundle_price"?: number | null,"bundle_qty"?: number | null,"buy_qty"?: number | null,"category"?: string | null,"code"?: string,"created_at"?: string,"days_of_week"?: (number)[] | null,"description"?: string,"end_time"?: string | null,"ends_at"?: string | null,"first_order_only"?: boolean,"flat_off"?: number | null,"free_item_id"?: number | null,"free_qty"?: number | null,"id"?: never,"is_active"?: boolean,"item_ids"?: (number)[],"max_discount"?: number | null,"max_total_uses"?: number | null,"max_uses_per_phone"?: number | null,"max_uses_per_user"?: number | null,"min_order_value"?: number,"min_qty"?: number,"percent_off"?: number | null,"start_time"?: string | null,"starts_at"?: string | null,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "coupons_free_item_id_fkey"
      columns: ["free_item_id"]
isOneToOne: false
      referencedRelation: "menu_items"
      referencedColumns: ["id"]
    }
                  ]
                },"menu_items": {
                  Row: {
                    "category": string,"cheese_price": number | null,"description": string,"id": number,"in_stock": boolean,"name": string,"price": number,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"cheese_price"?: number | null,"description"?: string,"id"?: never,"in_stock"?: boolean,"name": string,"price": number,"sort_order"?: number
                  }
                  Update: {
                    "category"?: string,"cheese_price"?: number | null,"description"?: string,"id"?: never,"in_stock"?: boolean,"name"?: string,"price"?: number,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"order_items": {
                  Row: {
                    "id": number,"menu_item_id": number | null,"name": string,"order_id": number,"qty": number,"unit_price": number,"variant": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"menu_item_id"?: number | null,"name": string,"order_id": number,"qty": number,"unit_price": number,"variant": string
                  }
                  Update: {
                    "id"?: never,"menu_item_id"?: number | null,"name"?: string,"order_id"?: number,"qty"?: number,"unit_price"?: number,"variant"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_menu_item_id_fkey"
      columns: ["menu_item_id"]
isOneToOne: false
      referencedRelation: "menu_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "address": string,"coupon_code": string | null,"created_at": string,"customer_name": string,"customer_phone": string,"discount": number,"id": number,"pincode": string,"status": string,"subtotal": number,"total": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address": string,"coupon_code"?: string | null,"created_at"?: string,"customer_name": string,"customer_phone": string,"discount"?: number,"id"?: never,"pincode"?: string,"status"?: string,"subtotal": number,"total": number,"user_id": string
                  }
                  Update: {
                    "address"?: string,"coupon_code"?: string | null,"created_at"?: string,"customer_name"?: string,"customer_phone"?: string,"discount"?: number,"id"?: never,"pincode"?: string,"status"?: string,"subtotal"?: number,"total"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"id": string,"name": string | null,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"id": string,"name"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"id"?: string,"name"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"shop_settings": {
                  Row: {
                    "id": boolean,"is_open": boolean,"note": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: boolean,"is_open"?: boolean,"note"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "id"?: boolean,"is_open"?: boolean,"note"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "coupon_usage": {
                  Row: {
                    "coupon_id": number,"uses": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "coupon_redemptions_coupon_id_fkey"
      columns: ["coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "_apply_coupon":
{ Args: { "p_code": string,"p_items": Json,"p_lock"?: boolean,"p_uid": string }; Returns: {
              "coupon_id": number,"discount": number,"free_item_id": number,"free_item_name": string,"ok": boolean,"reason": string
            }[]
                           },
"_cart_lines":
{ Args: { "p_items": Json }; Returns: {
              "category": string,"menu_item_id": number,"name": string,"qty": number,"unit_price": number,"variant": string
            }[]
                           },
"_seed_menu":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"bogo_available":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"place_order":
{ Args: { "p_address": string,"p_coupon_code"?: string,"p_items": Json }; Returns: {
              "coupon_code": string,"customer_name": string,"customer_phone": string,"discount": number,"lines": Json,"order_id": number,"subtotal": number,"total": number
            }[]
                           } |
{ Args: { "p_address": string,"p_items": Json,"p_use_bogo": boolean }; Returns: {
              "customer_name": string,"customer_phone": string,"discount": number,"lines": Json,"order_id": number,"subtotal": number,"total": number
            }[]
                           },
"reset_menu":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"validate_coupon":
{ Args: { "p_code": string,"p_items": Json }; Returns: {
              "coupon_code": string,"coupon_desc": string,"discount": number,"free_item_name": string,"reason": string,"valid": boolean
            }[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
