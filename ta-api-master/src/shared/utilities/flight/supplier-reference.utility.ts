export function parseSupplierReferenceIds(
    supplierReferenceId?: string | null,
): string[] {
    if (!supplierReferenceId?.trim()) {
        return [];
    }
    return supplierReferenceId
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
}

export function supplierReferenceIncludes(
    supplierReferenceId: string | null | undefined,
    tboBookingId: string | number,
): boolean {
    const target = tboBookingId.toString().trim();
    if (!target) {
        return false;
    }
    return parseSupplierReferenceIds(supplierReferenceId).includes(target);
}
