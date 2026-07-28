'use client'

import { Fragment, ReactNode, useMemo, useState } from 'react'
import { color, radius } from '@/lib/design-tokens'
import Button from './Button'
import { Spinner } from './LoadingState'
import { ChevronLeft, ChevronRight } from '../icons'

export type Column<T> = {
  key: string
  header: string
  align?: 'left' | 'right' | 'center'
  width?: string
  render: (row: T) => ReactNode
}

export default function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  emptyMessage = 'Nenhum registro encontrado.',
  pageSize = 25,
  onRowClick,
  renderExpandedRow,
  isRowExpanded,
}: {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string
  loading?: boolean
  emptyMessage?: string
  pageSize?: number
  onRowClick?: (row: T) => void
  renderExpandedRow?: (row: T) => ReactNode
  isRowExpanded?: (row: T) => boolean
}) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))
  const currentPage = Math.min(page, totalPages)

  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return data.slice(start, start + pageSize)
  }, [data, currentPage, pageSize])

  const clickable = Boolean(onRowClick)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ overflowX: 'auto', borderRadius: radius.md, border: `1px solid ${color.tableRowBorder}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
          <thead>
            <tr style={{ background: color.tableHeadBg }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    textAlign: col.align ?? 'left',
                    color: color.greenSofter,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    fontWeight: 700,
                    fontSize: '12px',
                    padding: '12px 14px',
                    width: col.width,
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '32px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <Spinner />
                  </div>
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ padding: '28px', textAlign: 'center', color: color.textSecondary, fontSize: '14px' }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const key = rowKey(row)
                const expanded = isRowExpanded?.(row) ?? false
                return (
                  <Fragment key={key}>
                    <tr
                      className={clickable ? 'az-row-hover az-clickable' : undefined}
                      onClick={() => onRowClick?.(row)}
                      style={{ borderTop: `1px solid ${color.tableRowBorder}` }}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          style={{
                            color: color.textPrimary,
                            fontSize: '14px',
                            padding: '12px 14px',
                            textAlign: col.align ?? 'left',
                          }}
                        >
                          {col.render(row)}
                        </td>
                      ))}
                    </tr>
                    {expanded && renderExpandedRow && (
                      <tr style={{ borderTop: `1px solid ${color.tableRowBorder}` }}>
                        <td colSpan={columns.length} style={{ padding: '0 14px 14px', background: 'rgba(2,6,23,0.4)' }}>
                          {renderExpandedRow(row)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && data.length > pageSize && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: color.textSecondary }}>
          <span>
            Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, data.length)} de {data.length}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              leftIcon={<ChevronLeft size={14} />}
            >
              Anterior
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Próxima
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
