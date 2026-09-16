# POS testing checklist

Use this checklist before opening or merging a change.

## Application checks

- [ ] Install dependencies successfully.
- [ ] Start the application using the documented command.
- [ ] Confirm the application loads without console errors.
- [ ] Verify the database connection when database-backed features are changed.

## Feature checks

- [ ] Test the changed feature with valid input.
- [ ] Test empty and invalid input where applicable.
- [ ] Verify success and error responses.
- [ ] Check that existing functionality still works.

## API and data checks

- [ ] Verify affected endpoints manually.
- [ ] Confirm expected status codes and response shapes.
- [ ] Confirm test data does not contain real credentials or secrets.

## Final review

- [ ] Review the diff for unrelated changes.
- [ ] Confirm no local environment files are committed.
- [ ] Record any known limitations in the PR description.
