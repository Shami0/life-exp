import { usersRepository } from "./users.repository";
import type { NewUser, User } from "./users.schema";

// Never send the password hash to clients
export function toPublicUser(user: User) {
  const { passwordHash, ...rest } = user;
  return rest;
}

export const usersService = {
  findByEmail: (email: string) => usersRepository.findByEmail(email),
  findById: (id: string) => usersRepository.findById(id),
  create: (data: NewUser) => usersRepository.create(data),
};