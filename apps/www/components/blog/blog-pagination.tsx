import Link from "next/link";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../ui/pagination";

export function BlogPagination({
  currentPage,
  numPages,
  buildPath,
  updateSearchParams,
}: {
  currentPage: number;
  numPages: number;
  buildPath: (page: number) => string;
  updateSearchParams?: (page: number) => void;
}) {
  if (numPages <= 1) {
    return null;
  }

  const PageButtons = () => {
    const content = [];
    const rangeStart = Math.max(1, currentPage - 2);
    const rangeEnd = Math.min(numPages, currentPage + 2);

    if (rangeStart > 1) {
      content.push(
        <PaginationItem key="1">
          {updateSearchParams ? (
            <PaginationLink onClick={() => updateSearchParams(1)}>1</PaginationLink>
          ) : (
            <Link href={buildPath(1)} prefetch>
              <PaginationLink>1</PaginationLink>
            </Link>
          )}
        </PaginationItem>,
      );
      if (rangeStart > 2) {
        content.push(<PaginationEllipsis key="start-ellipsis" />);
      }
    }

    for (let i = rangeStart; i <= rangeEnd; i++) {
      content.push(
        <PaginationItem key={i}>
          {updateSearchParams ? (
            <PaginationLink isActive={currentPage === i} onClick={() => updateSearchParams(i)}>
              {i}
            </PaginationLink>
          ) : (
            <Link href={buildPath(i)} prefetch>
              <PaginationLink isActive={currentPage === i}>{i}</PaginationLink>
            </Link>
          )}
        </PaginationItem>,
      );
    }

    if (rangeEnd < numPages) {
      if (rangeEnd < numPages - 1) {
        content.push(<PaginationEllipsis key="end-ellipsis" />);
      }
      content.push(
        <PaginationItem key={numPages}>
          {updateSearchParams ? (
            <PaginationLink onClick={() => updateSearchParams(numPages)}>{numPages}</PaginationLink>
          ) : (
            <Link href={buildPath(numPages)} prefetch>
              <PaginationLink>{numPages}</PaginationLink>
            </Link>
          )}
        </PaginationItem>,
      );
    }

    return content;
  };

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          {currentPage > 1 ? (
            updateSearchParams ? (
              <PaginationPrevious
                onClick={() => updateSearchParams(Math.max(1, currentPage - 1))}
              />
            ) : (
              <Link href={buildPath(Math.max(1, currentPage - 1))} prefetch>
                <PaginationPrevious />
              </Link>
            )
          ) : (
            <PaginationPrevious disabled />
          )}
        </PaginationItem>
        <PageButtons />
        <PaginationItem>
          {currentPage < numPages ? (
            updateSearchParams ? (
              <PaginationNext
                onClick={() => updateSearchParams(Math.min(numPages, currentPage + 1))}
              />
            ) : (
              <Link href={buildPath(Math.min(numPages, currentPage + 1))} prefetch>
                <PaginationNext />
              </Link>
            )
          ) : (
            <PaginationNext disabled />
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
